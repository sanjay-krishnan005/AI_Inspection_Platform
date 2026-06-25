from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict, Any

# Token schemas
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None

# User schemas
class UserBase(BaseModel):
    name: str
    role: str
    email: Optional[EmailStr] = None
    team: Optional[str] = None

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: int
    
    class Config:
        from_attributes = True

class UserLogin(BaseModel):
    email: EmailStr
    password: str

# Project & Location Schemas
class ProjectResponse(BaseModel):
    id: int
    name: str
    location: Optional[str] = None
    status: str
    
    class Config:
        from_attributes = True

class LocationResponse(BaseModel):
    id: str
    name: str
    
    class Config:
        from_attributes = True

# Issue schemas
class IssueBase(BaseModel):
    desc: str
    zone: str
    project_id: Optional[int] = 1
    severity: Optional[str] = "LOW — Minor observation"
    tags: Optional[str] = ""
    image: Optional[str] = None
    solution_rec: Optional[str] = None
    team_rec: Optional[str] = None

class IssueCreate(IssueBase):
    author: Optional[str] = "Inspector"
    assignee_id: Optional[int] = None

class IssueReview(BaseModel):
    status: str
    severity: str
    assignee_id: int
    deadline: str
    manager_name: Optional[str] = "Manager"

class IssueProgressUpdate(BaseModel):
    progress_pct: int
    status: str
    comments: str
    before_img: Optional[str] = None
    after_img: Optional[str] = None
    worker_id: int

class IssueVerify(BaseModel):
    action: str  # approve, rework
    manager_name: Optional[str] = "Sanjay V. (PM)"

class IssueResponse(IssueBase):
    id: int
    raw_desc: Optional[str] = None
    sevClass: Optional[str] = None
    sevLabel: Optional[str] = None
    author: Optional[str] = None
    timestamp: Optional[str] = None
    status: str
    assignee_id: Optional[int] = None
    deadline: Optional[str] = None
    assignee_name: Optional[str] = None
    assignee_team: Optional[str] = None
    
    class Config:
        from_attributes = True

# Daily logs schemas
class DailyLogCreate(BaseModel):
    worker_id: int
    log_text: str

class DailyLogResponse(BaseModel):
    id: int
    worker_id: int
    worker_name: Optional[str] = None
    worker_team: Optional[str] = None
    log_text: str
    formatted_report: str
    date: Optional[str] = None
    
    class Config:
        from_attributes = True

# Feed schemas
class FeedResponse(BaseModel):
    id: int
    text: str
    type: Optional[str] = None
    time: Optional[str] = None
    
    class Config:
        from_attributes = True

# Analytics & Dashboard schemas
class KPIStats(BaseModel):
    openCount: int
    captured: int
    resolved: int
    reportLag: float
    lagTrend: str
    lagGood: bool
    reworkRate: float
    reworkTrend: str
    reworkGood: bool
    criticalCount: int

class DashboardResponse(BaseModel):
    kpis: KPIStats
    trends: List[Dict[str, Any]]
    zoneStats: Dict[str, Any]
    issues: List[IssueResponse]

class ContractorPerformanceResponse(BaseModel):
    id: int
    name: str
    team: Optional[str] = None
    assigned: int
    resolved: int
    rework: int
    completionRate: str
    qualityScore: str
    avgTime: str

class IssueAuditResponse(BaseModel):
    logs: List[Dict[str, Any]]
    progress: List[Dict[str, Any]]

# Chat Assistant schemas
class ChatMessage(BaseModel):
    message: str

class ChatResponse(BaseModel):
    reply: str

class AIReportRequest(BaseModel):
    description: Optional[str] = None
    image: Optional[str] = None
