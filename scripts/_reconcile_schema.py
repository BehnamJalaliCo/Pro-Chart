"""Non-destructive schema reconciler: ADD any columns present in the SQLAlchemy
models but missing from the live DB. Never drops or alters existing columns.
Added columns are forced NULLable (with server_default when the model defines one)
so existing rows are unaffected. Safe to run repeatedly (idempotent)."""

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, inspect, text
from src.core.config import settings
import src.core.database as db  # noqa: F401 — imports all models onto Base.metadata

Base = db.Base

def sync_url() -> str:
    return (
        f"postgresql+psycopg2://{settings.DB_USER}:{settings.DB_PASSWORD}"
        f"@{settings.DB_HOST}:{settings.DB_PORT}/{settings.DB_NAME}"
    )

def main() -> None:
    engine = create_engine(sync_url())
    insp = inspect(engine)
    db_tables = set(insp.get_table_names())
    added = []
    missing_tables = []

    with engine.begin() as conn:
        for table_name, table in Base.metadata.tables.items():
            if table_name not in db_tables:
                missing_tables.append(table_name)
                continue
            existing_cols = {c["name"] for c in insp.get_columns(table_name)}
            for col in table.columns:
                if col.name in existing_cols:
                    continue
                coltype = col.type.compile(dialect=engine.dialect)
                ddl = f'ALTER TABLE "{table_name}" ADD COLUMN IF NOT EXISTS "{col.name}" {coltype}'
                # server_default (e.g. now(), true) preserved; otherwise leave NULLable.
                if col.server_default is not None:
                    default_txt = getattr(col.server_default, "arg", None)
                    if default_txt is not None:
                        ddl += f" DEFAULT {str(default_txt)}"
                conn.execute(text(ddl))
                added.append(f"{table_name}.{col.name} :: {coltype}")

    print("=== reconcile summary ===")
    print(f"tables in model: {len(Base.metadata.tables)} | in DB: {len(db_tables)}")
    if missing_tables:
        print(f"tables MISSING in DB (not created here): {missing_tables}")
    if added:
        print(f"columns ADDED ({len(added)}):")
        for a in added:
            print("  +", a)
    else:
        print("no missing columns — schema already in sync")

if __name__ == "__main__":
    main()
