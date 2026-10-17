// Runtime field read/write/verify operations

import { Buffer } from "buffer";
import { assertWritableContract } from "../../../../shared/protocol/contract.js";
import {
  buildRuntimeFieldWrite,
  readRuntimeFieldFromBuffer,
  resolveRuntimeField,
  runtimeFieldValuesEqual,
} from "../../../../shared/protocol/runtime-fields.js";
import { serialService } from "../../services/serialService.js";
import { recordRestartWrite } from '../utils/ecu.restart.js';
import { prepareConfigurationWrite } from '../../../../shared/protocol/configuration-policy.js';
import { configurationWriteOptions } from '../../../../shared/protocol/board-pins.js';
import { validateConfigurationValues } from '../../../../shared/protocol/configuration-validation.js';

export function createRuntimeFieldsSlice(set, get) {
  return {
    readRuntimeField: async (fieldName) => {
      const { parsedIni, connection, readPageFromECU } = get();
      if (connection.status !== "connected") {
        throw new Error("Not connected");
      }
      if (!parsedIni) {
        throw new Error("No INI loaded");
      }

      const field = resolveRuntimeField(parsedIni, fieldName);

      if (get().operation) throw new Error('Another ECU operation is running');
      const pollingSession = serialService.sessionGeneration;
      serialService.suspendOutputChannelsPolling();
      try {
        const page = await readPageFromECU(field.page);
        return {
          field,
          value: readRuntimeFieldFromBuffer(page.buffer, field),
          pageBuffer: page.buffer,
        };
      } finally {
        serialService.resumeOutputChannelsPolling(pollingSession);
      }
    },

    writeRuntimeField: async (fieldName, nextValue, options = {}) => {
      if (get().operation || ['ProfileActive', 'Unknown'].includes(get().runtimeProfileSession?.state)) throw new Error('Return the runtime profile to DEFAULT before manual RAM writes');
      const { parsedIni, connection, readPageFromECU } = get();
      if (connection.status !== "connected") {
        throw new Error("Not connected");
      }
      if (!parsedIni) {
        throw new Error("No INI loaded");
      }

      const field = resolveRuntimeField(parsedIni, fieldName);

      const epoch = get().projectEpoch;
      const rangeError = validateConfigurationValues(parsedIni, { [field.page]: { [field.name]: nextValue } });
      if (rangeError) throw new Error(rangeError);
      const session = get().connection.sessionId;
      const checkContext = () => {
        if (get().projectEpoch !== epoch || get().connection.sessionId !== session || get().parsedIni !== parsedIni) throw new Error("Project or ECU changed during manual write");
        assertWritableContract(get());
      };
      checkContext();
      const owner = {};
      get().setOperation({ owner, type: "runtime-write", scope: "runtime-write", label: "Manual ECU RAM write" });
      const pollingSession = serialService.sessionGeneration;
      serialService.suspendOutputChannelsPolling();
      try {
        const page = await readPageFromECU(field.page);
        checkContext();
        const currentValue = readRuntimeFieldFromBuffer(page.buffer, field);
        const write = buildRuntimeFieldWrite(page.buffer, field, nextValue);

        if (!write.changed) {
          return {
            field,
            changed: false,
            currentValue,
            writtenValue: nextValue,
          };
        }

        const target = Buffer.from(page.buffer);
        write.after.copy(target, write.offset);
        const prepared = await prepareConfigurationWrite(parsedIni, { [field.page]: target }, async id => {
          checkContext();
          const result = id === field.page ? page : await readPageFromECU(id);
          checkContext();
          return result;
        }, { ...configurationWriteOptions(get().currentProject), readCRC: id => serialService.readPageCRC(id) });
        await recordRestartWrite(set, get, parsedIni, prepared.before, prepared.after);
        checkContext();
        assertWritableContract(get());
        await serialService.writePage(
          field.page,
          write.offset,
          write.length,
          Array.from(write.after),
        );

        const verified = await readPageFromECU(field.page);
        checkContext();
        if (!Buffer.from(verified.buffer).equals(target)) throw new Error('Manual field RAM verification failed');

        return {
          field,
          changed: true,
          currentValue,
          writtenValue: nextValue,
          write,
        };
      } finally {
        serialService.resumeOutputChannelsPolling(pollingSession);
        if (get().operation?.owner === owner) get().clearOperation();
      }
    },

    verifyRuntimeField: async (fieldName, expectedValue) => {
      const result = await get().readRuntimeField(fieldName);
      return {
        ...result,
        expectedValue,
        matches: runtimeFieldValuesEqual(result.value, expectedValue),
      };
    },
  };
}
