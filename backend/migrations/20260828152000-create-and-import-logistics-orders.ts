import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { MigrationInterface, QueryRunner } from 'typeorm';

const TABLE_NAME = 'logistics_orders';
const DEFAULT_CSV_PATH = '/Users/jean/workspace/6-test/mock_logistics_data.csv';

const EXPECTED_HEADERS = [
  'client_id',
  'order_id',
  'order_date',
  'delivery_date',
  'carrier',
  'origin_city',
  'destination_city',
  'status',
  'sku',
  'product_category',
  'quantity',
  'unit_price_usd',
  'order_value_usd',
  'is_promo',
  'promo_discount_pct',
  'region',
  'warehouse',
] as const;

type LogisticsCsvHeader = (typeof EXPECTED_HEADERS)[number];
type LogisticsCsvRecord = Record<LogisticsCsvHeader, string>;

export class CreateAndImportLogisticsOrders20260828152000
  implements MigrationInterface
{
  name = 'CreateAndImportLogisticsOrders20260828152000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id TEXT NOT NULL,
        order_id TEXT NOT NULL UNIQUE,
        order_date TEXT NOT NULL,
        delivery_date TEXT NOT NULL,
        carrier TEXT NOT NULL,
        origin_city TEXT NOT NULL,
        destination_city TEXT NOT NULL,
        status TEXT NOT NULL,
        sku TEXT NOT NULL,
        product_category TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        unit_price_usd REAL NOT NULL,
        order_value_usd REAL NOT NULL,
        is_promo INTEGER NOT NULL DEFAULT 0,
        promo_discount_pct REAL NOT NULL,
        region TEXT NOT NULL,
        warehouse TEXT NOT NULL
      )
    `);

    const csvPath = resolve(process.env.LOGISTICS_CSV_PATH ?? DEFAULT_CSV_PATH);
    const csv = await readFile(csvPath, 'utf8');
    const records = parseLogisticsCsv(csv);

    for (const record of records) {
      await queryRunner.query(
        `
          INSERT INTO ${TABLE_NAME} (
            client_id,
            order_id,
            order_date,
            delivery_date,
            carrier,
            origin_city,
            destination_city,
            status,
            sku,
            product_category,
            quantity,
            unit_price_usd,
            order_value_usd,
            is_promo,
            promo_discount_pct,
            region,
            warehouse
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(order_id) DO UPDATE SET
            client_id = excluded.client_id,
            order_date = excluded.order_date,
            delivery_date = excluded.delivery_date,
            carrier = excluded.carrier,
            origin_city = excluded.origin_city,
            destination_city = excluded.destination_city,
            status = excluded.status,
            sku = excluded.sku,
            product_category = excluded.product_category,
            quantity = excluded.quantity,
            unit_price_usd = excluded.unit_price_usd,
            order_value_usd = excluded.order_value_usd,
            is_promo = excluded.is_promo,
            promo_discount_pct = excluded.promo_discount_pct,
            region = excluded.region,
            warehouse = excluded.warehouse
        `,
        [
          record.client_id,
          record.order_id,
          record.order_date,
          record.delivery_date,
          record.carrier,
          record.origin_city,
          record.destination_city,
          record.status,
          record.sku,
          record.product_category,
          parseInteger(record.quantity, 'quantity', record.order_id),
          parseNumber(record.unit_price_usd, 'unit_price_usd', record.order_id),
          parseNumber(record.order_value_usd, 'order_value_usd', record.order_id),
          parseBooleanInteger(record.is_promo, record.order_id),
          parseNumber(
            record.promo_discount_pct,
            'promo_discount_pct',
            record.order_id,
          ),
          record.region,
          record.warehouse,
        ],
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS ${TABLE_NAME}`);
  }
}

function parseLogisticsCsv(csv: string): LogisticsCsvRecord[] {
  const rows = parseCsvRows(csv.replace(/^\uFEFF/, ''));

  if (rows.length === 0) {
    return [];
  }

  const [headers, ...dataRows] = rows;
  assertExpectedHeaders(headers);

  return dataRows
    .filter((row) => row.some((field) => field.length > 0))
    .map((row, index) => {
      if (row.length !== EXPECTED_HEADERS.length) {
        throw new Error(
          `CSV row ${index + 2} has ${row.length} fields; expected ${EXPECTED_HEADERS.length}`,
        );
      }

      return Object.fromEntries(
        EXPECTED_HEADERS.map((header, columnIndex) => [
          header,
          row[columnIndex] ?? '',
        ]),
      ) as LogisticsCsvRecord;
    });
}

function parseCsvRows(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    const nextChar = csv[index + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }

      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (char !== '\r') {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function assertExpectedHeaders(headers: string[]): void {
  const actual = headers.join(',');
  const expected = EXPECTED_HEADERS.join(',');

  if (actual !== expected) {
    throw new Error(`Unexpected CSV headers: ${actual}`);
  }
}

function parseInteger(value: string, field: string, orderId: string): number {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed)) {
    throw new Error(`Invalid ${field} for ${orderId}: ${value}`);
  }

  return parsed;
}

function parseNumber(value: string, field: string, orderId: string): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid ${field} for ${orderId}: ${value}`);
  }

  return parsed;
}

function parseBooleanInteger(value: string, orderId: string): number {
  if (value !== '0' && value !== '1') {
    throw new Error(`Invalid is_promo for ${orderId}: ${value}`);
  }

  return value === '1' ? 1 : 0;
}
