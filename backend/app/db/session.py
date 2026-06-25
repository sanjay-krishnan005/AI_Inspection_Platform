from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.core.config import settings

# Determine database engine parameters based on configuration url
database_url = settings.DATABASE_URL

if not database_url:
    # Local SQLite fallback
    database_url = "sqlite:///./data.db"
    connect_args = {"check_same_thread": False}
    print("Database session: Fallback to local SQLite connection.")
else:
    # SQLAlchemy 1.4+ requires postgresql:// instead of postgres://
    if database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql://", 1)
    
    # Supabase / Production PG requires sslmode or typical connection args (none strictly required by default but good to handle)
    connect_args = {}
    print(f"Database session: Connecting to configured database.")

engine = create_engine(
    database_url,
    connect_args=connect_args,
    pool_pre_ping=True,
    pool_recycle=300
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Dependency generator to retrieve db sessions in path operations
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
