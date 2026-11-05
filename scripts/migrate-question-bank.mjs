import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';

const columns = ['id','exam_type','subject','topic','subtopic','year','question','option_a','option_b','option_c','option_d','answer','explanation','explanation_short','difficulty','difficulty_actual','concepts','common_wrong_answer','source','status','confidence_score','flag_count','verified_by','created_at','updated_at','notes'];
const pageSize = 250;
const batchSize = 100;
const expectedRows = Number(process.env.EXPECTED_QUESTION_BANK_ROWS || 10369);
const execute = process.argv.includes('--execute');

function env(name) {
  const value = process.env[name];
  if (!value) throw new Error('Missing environment variable: ' + name);
  return value;
}
function client(urlName, keyName) {
  return createClient(env(urlName), env(keyName), { auth: { persistSession: false, autoRefreshToken: false } });
}
function hash(row) {
  return createHash('sha256').update(JSON.stringify(columns.map((key) => row[key] ?? null))).digest('hex');
}
async function readAll(db, label) {
  const rows = [];
  for (let start = 0; ; start += pageSize) {
    const { data, error } = await db.from('question_bank').select(columns.join(',')).order('id').range(start, start + pageSize - 1);
    if (error) throw new Error(label + ' read failed at offset ' + start + ': ' + error.message);
    rows.push(...(data || []));
    if (!data || data.length < pageSize) return rows;
  }
}
async function main() {
  if (!Number.isInteger(expectedRows) || expectedRows < 1) throw new Error('Invalid EXPECTED_QUESTION_BANK_ROWS');
  if (execute && process.env.SABI_MIGRATION_CONFIRM !== 'IMPORT_QUESTION_BANK_10369') throw new Error('Explicit import confirmation missing');
  const source = client('SOURCE_SUPABASE_URL', 'SOURCE_SUPABASE_SERVICE_ROLE_KEY');
  const destination = client('DESTINATION_SUPABASE_URL', 'DESTINATION_SUPABASE_SERVICE_ROLE_KEY');

  console.log('Reading and validating source…');
  const sourceRows = await readAll(source, 'Source');
  if (sourceRows.length !== expectedRows) throw new Error('Source count changed: ' + sourceRows.length + '; expected ' + expectedRows);
  if (new Set(sourceRows.map((row) => row.id)).size !== sourceRows.length) throw new Error('Duplicate source IDs detected');
  console.log('Source validated:', sourceRows.length);

  if (execute) {
    console.log('Importing in resumable, non-overwriting batches…');
    for (let offset = 0; offset < sourceRows.length; offset += batchSize) {
      const { error } = await destination.from('question_bank').upsert(sourceRows.slice(offset, offset + batchSize), { onConflict: 'id', ignoreDuplicates: true });
      if (error) throw new Error('Import failed at offset ' + offset + ': ' + error.message);
      console.log('Processed ' + Math.min(offset + batchSize, sourceRows.length) + '/' + sourceRows.length);
    }
  } else {
    console.log('DRY RUN: no destination writes performed');
  }

  console.log('Reading destination and comparing every source column…');
  const destinationRows = await readAll(destination, 'Destination');
  const sourceMap = new Map(sourceRows.map((row) => [row.id, row]));
  const destinationMap = new Map(destinationRows.map((row) => [row.id, row]));
  const missing = [], mismatched = [], extra = [];
  for (const [id, row] of sourceMap) {
    const target = destinationMap.get(id);
    if (!target) missing.push(id);
    else if (hash(row) !== hash(target)) mismatched.push(id);
  }
  for (const id of destinationMap.keys()) if (!sourceMap.has(id)) extra.push(id);
  const counts = (rows) => rows.reduce((out, row) => { const key = row.status ?? '<NULL>'; out[key] = (out[key] || 0) + 1; return out; }, {});
  const report = { mode: execute ? 'execute' : 'dry-run', sourceRows: sourceRows.length, destinationRows: destinationRows.length, sourceStatusCounts: counts(sourceRows), destinationStatusCounts: counts(destinationRows), missing: missing.length, mismatched: mismatched.length, extra: extra.length, parity: !missing.length && !mismatched.length && !extra.length };
  console.log('\nQUESTION BANK MIGRATION REPORT\n' + JSON.stringify(report, null, 2));
  if (execute && !report.parity) process.exitCode = 2;
}
main().catch((error) => { console.error('QUESTION BANK MIGRATION FAILED:', error.message); process.exitCode = 1; });
