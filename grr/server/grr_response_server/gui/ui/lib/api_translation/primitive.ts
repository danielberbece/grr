import {AnyObject} from '@app/lib/api/api_interfaces';

/**
 * Constructs a Date from a unixtime string with microsecond-precision.
 *
 * Because `Date` uses millisecond-precision, microseconds are truncated.
 */
export function createDate(apiTimestamp: string): Date {
  if (!apiTimestamp) {
    throw new Error(`Date must not be empty.`);
  }
  const date = new Date(Number(apiTimestamp) / 1000);
  if (isNaN(date.valueOf())) {
    throw new Error(`Date "${apiTimestamp}" is invalid.`);
  }
  return date;
}

/**
 * Constructs a Date from a unixtime string with microsecond-precision.
 *
 * Because `Date` uses millisecond-precision, microseconds are truncated. This
 * function returns undefined when given undefined or the empty string.
 */
export function createOptionalDate(apiTimestamp: undefined): undefined;
export function createOptionalDate(apiTimestamp: ''): undefined;
export function createOptionalDate(apiTimestamp: string): Date;
export function createOptionalDate(apiTimestamp?: string): Date | undefined;

export function createOptionalDate(apiTimestamp?: string): Date | undefined {
  if (!apiTimestamp) {
    return undefined;  // Return undefined for undefined and empty string.
  }
  return createDate(apiTimestamp);
}

/**
 * Constructs a Date from a unixtime string with seconds precision.
 */
export function createOptionalDateSeconds(timestampSeconds: undefined):
  undefined;
export function createOptionalDateSeconds(timestampSeconds: string): Date;
export function createOptionalDateSeconds(timestampSeconds?: string): Date |
  undefined;

export function createOptionalDateSeconds(timestampSeconds?: string): Date |
  undefined {
  if (!timestampSeconds) {
    return undefined;
  }
  const result = new Date(Number(timestampSeconds) * 1000);
  if (isNaN(result.valueOf())) {
    throw new Error(`Date "${timestampSeconds}" is invalid.`);
  }
  return result;
}



/**
 * Creates an unknown object out of protobuf's any object.
 * Unknown is different from any as, unlike any, it has to be explicitly cast
 * to a type for any use.
 */
export function createUnknownObject(anyObject?: AnyObject): unknown | undefined {
  if (!anyObject) {
    return undefined;
  }

  const result = {...anyObject};
  delete result['@type'];
  return result;
}

/**
 * Decodes a encoded base64 string into a byte array.
 * On error, returns an empty array.
 */
export function decodeBase64(encodedString?: string): Uint8Array {
  if (encodedString === undefined) {
    return new Uint8Array();
  }

  let decodedString;
  try {
    decodedString = atob(encodedString);
  } catch (err) {
    return new Uint8Array();
  }
  const byteArray = new Uint8Array(decodedString.length);
  for (let i = 0; i < decodedString.length; i++) {
    byteArray[i] = decodedString.charCodeAt(i);
  }

  return byteArray;
}

/** Returns the uppercase hex representation of the first byte of the provided number */
export function byteToHex(number: number): string {
  number = number & 0x0FF;

  return number.toString(16).toUpperCase().padStart(2, '0');
}

/** Creates IPv4 address string from a 4 bytes array */
export function createIpv4Address(bytes: Uint8Array): string {
  if (bytes.length !== 4) {
    return '';
  }

  return `${bytes[0]}.${bytes[1]}.${bytes[2]}.${bytes[3]}`;
}

/**
 * Creates IPv6 non-abbreviated address string from a 16 bytes array
 */
export function createIpv6Address(bytes: Uint8Array): string {
  if (bytes.length !== 16) {
    return '';
  }

  let ipString = `${byteToHex(bytes[0])}${byteToHex(bytes[1])}`;
  for (let i = 2; i < 16; i += 2) {
    ipString += `:${byteToHex(bytes[i])}${byteToHex(bytes[i + 1])}`;
  }

  return ipString;
}

/** Creates a MAC Address string from a 6 bytes array */
export function createMacAddress(bytes: Uint8Array): string {
  if (bytes.length !== 6) {
    return '';
  }

  let macString = `${byteToHex(bytes[0])}`;
  for (let i = 1; i < 6; i++) {
    macString += `:${byteToHex(bytes[i])}`;
  }

  return macString;
}
