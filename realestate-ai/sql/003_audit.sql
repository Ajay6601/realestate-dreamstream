-- Row-level audit triggers: who changed what, when, with before/after images.

CREATE OR REPLACE FUNCTION app.audit_row_change() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_old     jsonb;
  v_new     jsonb;
  v_changed jsonb := '[]'::jsonb;
  v_record  uuid;
  v_tenant  uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_new := to_jsonb(NEW);
    v_record := NEW.id;
    v_tenant := NEW.tenant_id;
  ELSIF TG_OP = 'UPDATE' THEN
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    -- ignore no-op updates and pure updated_at bumps
    IF (v_old - 'updated_at') = (v_new - 'updated_at') THEN
      RETURN NEW;
    END IF;
    SELECT COALESCE(jsonb_agg(n.key ORDER BY n.key), '[]'::jsonb) INTO v_changed
      FROM jsonb_each(v_new) AS n
     WHERE n.key <> 'updated_at' AND n.value IS DISTINCT FROM (v_old -> n.key);
    v_record := NEW.id;
    v_tenant := NEW.tenant_id;
  ELSE
    v_old := to_jsonb(OLD);
    v_record := OLD.id;
    v_tenant := OLD.tenant_id;
  END IF;

  INSERT INTO audit_log (table_name, record_id, tenant_id, action, changed_fields, old_data, new_data, changed_by)
  VALUES (TG_TABLE_NAME, v_record, v_tenant, TG_OP, v_changed, v_old, v_new, app.current_user_id());

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END
$$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['properties', 'leads', 'outreach_messages'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', t || '_audit', t);
    EXECUTE format('CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON %I '
                   'FOR EACH ROW EXECUTE FUNCTION app.audit_row_change()', t || '_audit', t);
  END LOOP;
END
$$;

-- Tamper resistance: the log is append-only, even for the table owner.
CREATE OR REPLACE FUNCTION app.audit_log_immutable() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only (% blocked)', TG_OP USING ERRCODE = 'insufficient_privilege';
END
$$;

DROP TRIGGER IF EXISTS audit_log_no_update_delete ON audit_log;
CREATE TRIGGER audit_log_no_update_delete BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION app.audit_log_immutable();
DROP TRIGGER IF EXISTS audit_log_no_truncate ON audit_log;
CREATE TRIGGER audit_log_no_truncate BEFORE TRUNCATE ON audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION app.audit_log_immutable();
