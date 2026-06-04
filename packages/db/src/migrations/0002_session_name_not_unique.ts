export const id = '0002_session_name_not_unique'

export const sql = `
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_tenant_id_name_key;
`
