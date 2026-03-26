// TunerStudio Serial Protocol — command bytes
export const CMD = {
  TEST_COMMS: 'C',       // Handshake — ECU replies with 'A'
  QUERY_SIG:  'Q',       // Query firmware signature string
  REALTIME:   'A',       // Request 138-byte realtime data packet
  READ_PAGE:  'r',       // Read config/table page
  WRITE_PAGE: 'w',       // Write config/table page
  PAGE_CRC:   'd',       // Request CRC32 of a page
  BURN_EEPROM:'b',       // Burn current page to EEPROM
};

// Page numbers (from Speeduino firmware)
export const PAGE = {
  VE:       2,
  IGNITION: 3,
  AFR:      4,
  CONFIG1:  1,
  CONFIG2:  10,
};

export const BAUD_RATES = [9600, 19200, 38400, 57600, 115200];

export const REALTIME_PACKET_SIZE = 138;
