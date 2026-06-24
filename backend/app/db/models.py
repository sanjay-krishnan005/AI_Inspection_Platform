from sqlalchemy import Column, Integer, String, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.db.session import Base

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    role = Column(String(50), nullable=False)  # inspector, manager, worker, admin
    email = Column(String(100), unique=True, index=True, nullable=True)
    team = Column(String(100), nullable=True)
    hashed_password = Column(String(255), nullable=True) # for production JWT

    issues_assigned = relationship("Issue", back_populates="assignee")
    progress_updates = relationship("ProgressUpdate", back_populates="worker")
    daily_logs = relationship("DailyLog", back_populates="worker")


class Project(Base):
    __tablename__ = "projects"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False)
    location = Column(String(200), nullable=True)
    status = Column(String(50), default="active")

    issues = relationship("Issue", back_populates="project")


class Location(Base):
    __tablename__ = "locations"
    
    id = Column(String(50), primary_key=True)
    name = Column(String(100), nullable=False)


class Issue(Base):
    __tablename__ = "issues"
    
    id = Column(Integer, primary_key=True)
    desc = Column(Text, nullable=False)
    raw_desc = Column(Text, nullable=True)
    severity = Column(String(100), nullable=True)
    sevClass = Column(String(50), nullable=True)
    sevLabel = Column(String(50), nullable=True)
    zone = Column(String(50), nullable=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)
    author = Column(String(100), nullable=True)
    timestamp = Column(String(100), nullable=True)
    status = Column(String(50), default="pending_review") # pending_review, open, in_progress, waiting_for_approval, resolved
    category = Column(String(100), nullable=True)
    solution_rec = Column(Text, nullable=True)
    team_rec = Column(String(100), nullable=True)
    image = Column(String(255), nullable=True)
    assignee_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    deadline = Column(String(100), nullable=True)

    project = relationship("Project", back_populates="issues")
    assignee = relationship("User", back_populates="issues_assigned")
    progress_updates = relationship("ProgressUpdate", back_populates="issue")
    audit_logs = relationship("AuditLog", back_populates="issue")


class ProgressUpdate(Base):
    __tablename__ = "progress_updates"
    
    id = Column(Integer, primary_key=True, index=True)
    issue_id = Column(Integer, ForeignKey("issues.id"))
    worker_id = Column(Integer, ForeignKey("users.id"))
    timestamp = Column(String(100), nullable=True)
    progress_pct = Column(Integer, default=0)
    comments = Column(Text, nullable=True)
    before_img = Column(String(255), nullable=True)
    after_img = Column(String(255), nullable=True)

    issue = relationship("Issue", back_populates="progress_updates")
    worker = relationship("User", back_populates="progress_updates")


class DailyLog(Base):
    __tablename__ = "daily_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    worker_id = Column(Integer, ForeignKey("users.id"))
    log_text = Column(Text, nullable=False)
    formatted_report = Column(Text, nullable=False)
    date = Column(String(100), nullable=True)

    worker = relationship("User", back_populates="daily_logs")


class Feed(Base):
    __tablename__ = "feed"
    
    id = Column(Integer, primary_key=True, index=True)
    text = Column(Text, nullable=False)
    type = Column(String(50), nullable=True)  # teal, amber, red, blue
    time = Column(String(100), nullable=True)


class SystemStats(Base):
    __tablename__ = "system_stats"
    
    key = Column(String(100), primary_key=True)
    value = Column(Integer, nullable=False)


class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    issue_id = Column(Integer, ForeignKey("issues.id"))
    action = Column(Text, nullable=False)
    timestamp = Column(String(100), nullable=True)
    user = Column(String(100), nullable=True)

    issue = relationship("Issue", back_populates="audit_logs")
