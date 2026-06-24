import os
from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Dict, Any, Optional
import time
from datetime import datetime
import json
import requests

from app.core.config import settings
from app.core.security import get_password_hash, verify_password, create_access_token
from app.db.session import engine, Base, get_db
from app.db import models
from app.db.models import User, Project, Location, Issue, ProgressUpdate, DailyLog, Feed, SystemStats, AuditLog
from app import schemas

# Create database tables if they do not exist
Base.metadata.create_all(bind=engine)

from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

app = FastAPI(title=settings.PROJECT_NAME)

# Mount static files for uploads
uploads_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "public", "uploads")
os.makedirs(uploads_dir, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    import json
    error_data = {
        "errors": exc.errors(),
        "body": exc.body
    }
    try:
        with open("validation_error.log", "w") as f:
            json.dump(error_data, f, indent=2)
    except Exception as e:
        print("Failed to write validation error log file:", e)
        
    print("\n--- FASTAPI VALIDATION ERROR WRITTEN TO LOG ---")
    print("Errors:", exc.errors())
    print("--------------------------------\n")
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": exc.errors(), "body": exc.body}
    )


# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For local development simulation
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login")

# Seeding database on startup if empty
@app.on_event("startup")
def db_seed():
    db = next(get_db())
    try:
        user_count = db.query(User).count()
        if user_count == 0:
            print("Seeding database with mock data...")
            
            # Projects
            proj1 = Project(name="Signature Bridge Project", location="Sector-4, River Bed")
            proj2 = Project(name="East Coast Highway Overpass", location="National Highway 10")
            db.add_all([proj1, proj2])
            db.commit()
            
            # Locations
            locs = [
                Location(id="Zone A", name="East Anchorage"),
                Location(id="Zone B", name="East Bridge Deck"),
                Location(id="Zone C", name="West Bridge Deck"),
                Location(id="Zone D", name="West Anchorage"),
                Location(id="Zone E", name="Pivot Mechanism"),
                Location(id="Zone F", name="Structural Core")
            ]
            existing = db.query(Location).first()

            if not existing:
                db.add_all(locs)
                db.commit()
            
            # Users
            pw_hash = get_password_hash("password123")
            u1 = User(name="Priya M.", role="inspector", email="priya@aiinspect.pro", team="Quality Inspector", hashed_password=pw_hash)
            u2 = User(name="Ravi K.", role="inspector", email="ravi@aiinspect.pro", team="Safety Inspector", hashed_password=pw_hash)
            u3 = User(name="Sanjay V.", role="manager", email="sanjay@aiinspect.pro", team="Project Manager", hashed_password=pw_hash)
            
            # Contractor Teams
            c1 = User(name="Civil Team (Contractor)", role="worker", email="civil@contractor.com", team="Civil Team", hashed_password=pw_hash)
            c2 = User(name="MEP Team (Contractor)", role="worker", email="mep@contractor.com", team="MEP Team", hashed_password=pw_hash)
            c3 = User(name="Electrical Team (Contractor)", role="worker", email="electrical@contractor.com", team="Electrical Team", hashed_password=pw_hash)
            c4 = User(name="Safety Officer", role="worker", email="safety@contractor.com", team="Safety Officer", hashed_password=pw_hash)
            
            db.add_all([u1, u2, u3, c1, c2, c3, c4])
            db.commit()
            
            # System Stats (Init to 0)
            s1 = SystemStats(key="total_captured", value=0)
            s2 = SystemStats(key="total_resolved", value=0)
            db.add_all([s1, s2])
            db.commit()
            
            print("Database initialized clean for real-time testing!")
    finally:
        db.close()

# Helper functions matching Express stats logic
def get_zone_stats(db: Session):
    stats = {
        'Zone A': {'pct': 88, 'issues': 0},
        'Zone B': {'pct': 61, 'issues': 0},
        'Zone C': {'pct': 44, 'issues': 0},
        'Zone D': {'pct': 72, 'issues': 0},
        'Zone E': {'pct': 95, 'issues': 0},
        'Zone F': {'pct': 90, 'issues': 0}
    }
    issues = db.query(Issue.zone).filter(Issue.status != 'resolved').all()
    for i in issues:
        if i.zone in stats:
            stats[i.zone]['issues'] += 1
            
    for z in stats:
        if stats[z]['issues'] == 0:
            stats[z]['color'] = '#00A388'  # teal
        elif stats[z]['issues'] == 1:
            stats[z]['color'] = '#DE8B26'  # amber
        else:
            stats[z]['color'] = '#E65A5A'  # red
    return stats

def get_metrics(db: Session):
    open_issues = db.query(Issue).filter(Issue.status != 'resolved').all()
    open_count = len(open_issues)
    
    high_count = len([i for i in open_issues if i.sevClass == 'high'])
    med_count = len([i for i in open_issues if i.sevClass == 'med'])
    
    report_lag = max(0.5, 3.4 + high_count * 0.3 + med_count * 0.1)
    lag_trend = "▼ was 72h baseline" if open_count <= 4 else f"▲ High issues: {high_count}"
    lag_good = open_count <= 4
    
    rework_rate = max(1.0, 6.1 + high_count * 0.5 + med_count * 0.2)
    rework_trend = "▼ 25% reduction" if open_count <= 4 else f"▲ {high_count} high-risk open"
    rework_good = open_count <= 4
    
    critical_count = high_count
    
    return {
        "reportLag": round(report_lag, 1),
        "lagTrend": lag_trend,
        "lagGood": lag_good,
        "reworkRate": round(rework_rate, 1),
        "reworkTrend": rework_trend,
        "reworkGood": rework_good,
        "criticalCount": critical_count,
        "openCount": open_count
    }

def get_category_distribution(db: Session):
    all_issues = db.query(Issue.category).all()
    counts = {'Safety': 0, 'Structural': 0, 'MEP': 0, 'Civil': 0, 'Utilities': 0, 'Quality': 0, 'Uncategorized': 0}
    for i in all_issues:
        cat = i.category or 'Uncategorized'
        if cat in counts:
            counts[cat] += 1
        else:
            counts['Uncategorized'] += 1
            
    result = []
    for k, v in counts.items():
        if v > 0:
            result.append({"name": k, "value": v})
    return result if result else [{"name": "No Data", "value": 1}]

def get_contractor_performance(db: Session):
    workers = db.query(User).filter(User.role == "worker").all()
    perf = []
    for w in workers:
        total_assigned = db.query(Issue).filter(Issue.assignee_id == w.id).count()
        total_resolved = db.query(Issue).filter(Issue.assignee_id == w.id, Issue.status == "resolved").count()
        rework_count = db.query(AuditLog).join(Issue, AuditLog.issue_id == Issue.id).filter(Issue.assignee_id == w.id, AuditLog.action.like('%Rework%')).count()
        
        comp_rate = round((total_resolved / total_assigned * 100)) if total_assigned > 0 else 100
        quality_score = max(50, 100 - (rework_count * 12))
        
        avg_time = "24h"
        if "Electrical" in w.name:
            avg_time = "18h"
        elif "MEP" in w.name:
            avg_time = "14h"
        elif "Civil" in w.name:
            avg_time = "32h"
            
        perf.append({
            "id": w.id,
            "name": w.name,
            "team": w.team,
            "assigned": total_assigned,
            "resolved": total_resolved,
            "rework": rework_count,
            "completionRate": f"{comp_rate}%",
            "qualityScore": f"{quality_score}%",
            "avgTime": avg_time
        })
    return perf

# --- API ENDPOINTS ---

# Authentication
@app.post(f"{settings.API_V1_STR}/auth/register", response_model=schemas.UserResponse)
def register(user_in: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.email == user_in.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_pw = get_password_hash(user_in.password)
    user = User(
        name=user_in.name,
        role=user_in.role,
        email=user_in.email,
        team=user_in.team,
        hashed_password=hashed_pw
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

@app.post(f"{settings.API_V1_STR}/auth/login", response_model=schemas.Token)
def login(login_in: schemas.UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == login_in.email).first()
    if not user or not verify_password(login_in.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    
    access_token = create_access_token(subject=user.email)
    return {"access_token": access_token, "token_type": "bearer"}

# Dashboard
@app.get(f"{settings.API_V1_STR}/dashboard", response_model=schemas.DashboardResponse)
def dashboard(db: Session = Depends(get_db)):
    metrics = get_metrics(db)
    
    # Fetch all issues, joining with User assignee
    issues_db = db.query(Issue, User.name, User.team).outerjoin(User, Issue.assignee_id == User.id).all()
    issues = []
    
    # Sort order logic: pending_review, open, in_progress, waiting_for_approval, resolved
    status_order = {'pending_review': 1, 'open': 2, 'in_progress': 3, 'waiting_for_approval': 4, 'resolved': 5}
    sorted_issues_db = sorted(issues_db, key=lambda x: (status_order.get(x[0].status, 6), -x[0].id))
    
    for i, a_name, a_team in sorted_issues_db:
        issues.append(schemas.IssueResponse(
            id=i.id,
            desc=i.desc,
            raw_desc=i.raw_desc,
            severity=i.severity,
            sevClass=i.sevClass,
            sevLabel=i.sevLabel,
            zone=i.zone,
            project_id=i.project_id,
            author=i.author,
            timestamp=i.timestamp,
            status=i.status,
            category=i.category,
            solution_rec=i.solution_rec,
            team_rec=i.team_rec,
            image=i.image,
            assignee_id=i.assignee_id,
            deadline=i.deadline,
            assignee_name=a_name,
            assignee_team=a_team
        ))
        
    cap_stat = db.query(SystemStats).filter(SystemStats.key == "total_captured").first()
    res_stat = db.query(SystemStats).filter(SystemStats.key == "total_resolved").first()
    total_captured = cap_stat.value if cap_stat else 24
    total_resolved = res_stat.value if res_stat else 19

    kpis = schemas.KPIStats(
        openCount=metrics["openCount"],
        captured=total_captured,
        resolved=total_resolved,
        reportLag=metrics["reportLag"],
        lagTrend=metrics["lagTrend"],
        lagGood=metrics["lagGood"],
        reworkRate=metrics["reworkRate"],
        reworkTrend=metrics["reworkTrend"],
        reworkGood=metrics["reworkGood"],
        criticalCount=metrics["criticalCount"]
    )
    
    trends = [
        {"day": 'M', "logged": 5, "resolved": 3},
        {"day": 'T', "logged": 8, "resolved": 6},
        {"day": 'W', "logged": 12, "resolved": 9},
        {"day": 'T', "logged": 7, "resolved": 10},
        {"day": 'F', "logged": 15, "resolved": 4},
        {"day": 'S', "logged": 4, "resolved": 8},
        {"day": 'S', "logged": 2, "resolved": 5}
    ]

    return schemas.DashboardResponse(
        kpis=kpis,
        trends=trends,
        zoneStats=get_zone_stats(db),
        issues=issues
    )

# Workers & Contractor logs
@app.get(f"{settings.API_V1_STR}/workers", response_model=List[schemas.UserResponse])
def get_workers(db: Session = Depends(get_db)):
    return db.query(User).filter(User.role == "worker").all()

# Create Issue
@app.post(f"{settings.API_V1_STR}/issues")
def create_issue(issue_in: schemas.IssueCreate, db: Session = Depends(get_db)):
    sev_class = 'high' if ('HIGH' in issue_in.severity or 'CRITICAL' in issue_in.severity) else ('med' if 'MED' in issue_in.severity else 'ok')
    sev_label = 'HIGH' if 'HIGH' in issue_in.severity else ('CRITICAL' if 'CRITICAL' in issue_in.severity else ('MED' if 'MED' in issue_in.severity else 'LOW'))
    
    new_issue = Issue(
        id=int(time.time()),
        desc=issue_in.desc,
        raw_desc=issue_in.desc.replace("<strong>", "").replace("</strong>", "").replace("<br>", "").strip(),
        severity=issue_in.severity,
        sevClass=sev_class,
        sevLabel=sev_label,
        zone=issue_in.zone,
        project_id=issue_in.project_id or 1,
        author=issue_in.author or "Priya M. (Inspector)",
        timestamp="Now",
        status="pending_review",
        category=issue_in.tags.split(',')[0] if issue_in.tags else "Quality",
        solution_rec=issue_in.solution_rec or "Review alignment guidelines.",
        team_rec=issue_in.team_rec or "Civil Team",
        image=issue_in.image
    )
    db.add(new_issue)
    
    cap_stat = db.query(SystemStats).filter(SystemStats.key == "total_captured").first()
    if cap_stat:
        cap_stat.value += 1
        
    db.commit()
    
    # Audit log
    audit = AuditLog(issue_id=new_issue.id, action="Issue Logged by Inspector", timestamp="Now", user=new_issue.author)
    db.add(audit)
    
    feed = Feed(text=f"{new_issue.zone} — New Inspection logged for review", type="amber", time="Now")
    db.add(feed)
    db.commit()
    
    return {"success": True, "id": new_issue.id}

# Manager Review
@app.post(f"{settings.API_V1_STR}/issues/{{id}}/review")
def review_issue(id: int, review: schemas.IssueReview, db: Session = Depends(get_db)):
    issue = db.query(Issue).filter(Issue.id == id).first()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
        
    sev_class = 'high' if ('HIGH' in review.severity or 'CRITICAL' in review.severity) else ('med' if 'MED' in review.severity else 'ok')
    sev_label = 'HIGH' if 'HIGH' in review.severity else ('CRITICAL' if 'CRITICAL' in review.severity else ('MED' if 'MED' in review.severity else 'LOW'))
    
    issue.status = review.status
    issue.severity = review.severity
    issue.sevClass = sev_class
    issue.sevLabel = sev_label
    issue.assignee_id = review.assignee_id
    issue.deadline = review.deadline
    
    worker = db.query(User).filter(User.id == review.assignee_id).first()
    worker_name = worker.name if worker else "Contractor"
    
    # Add audit log
    audit = AuditLog(
        issue_id=id,
        action=f"Approved. Status set to: {review.status}. Assigned to: {worker_name}. Deadline: {review.deadline}",
        timestamp="Now",
        user=review.manager_name
    )
    db.add(audit)
    
    feed = Feed(text=f"PM approved task. {worker_name} dispatched to {issue.zone}", type="blue", time="Now")
    db.add(feed)
    db.commit()
    
    return {"success": True}

# Worker Progress Update
@app.post(f"{settings.API_V1_STR}/issues/{{id}}/progress")
def progress_update(id: int, progress: schemas.IssueProgressUpdate, db: Session = Depends(get_db)):
    issue = db.query(Issue).filter(Issue.id == id).first()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
        
    issue.status = progress.status
    
    update = ProgressUpdate(
        issue_id=id,
        worker_id=progress.worker_id,
        timestamp="Now",
        progress_pct=progress.progress_pct,
        comments=progress.comments,
        before_img=progress.before_img,
        after_img=progress.after_img
    )
    db.add(update)
    
    worker = db.query(User).filter(User.id == progress.worker_id).first()
    worker_name = worker.name if worker else "Worker"
    
    audit = AuditLog(
        issue_id=id,
        action=f"Progress updated to {progress.progress_pct}%. Status: {progress.status}.",
        timestamp="Now",
        user=worker_name
    )
    db.add(audit)
    
    feed = Feed(text=f"{worker_name} logged progress: {progress.progress_pct}% completed.", type="teal", time="Now")
    db.add(feed)
    db.commit()
    return {"success": True}

# Manager Verification
@app.post(f"{settings.API_V1_STR}/issues/{{id}}/verify")
def verify_issue(id: int, verify: schemas.IssueVerify, db: Session = Depends(get_db)):
    issue = db.query(Issue).filter(Issue.id == id).first()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
        
    if verify.action == "approve":
        issue.status = "resolved"
        date_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        # Increment total resolved
        res_stat = db.query(SystemStats).filter(SystemStats.key == "total_resolved").first()
        if res_stat:
            res_stat.value += 1
            
        audit = AuditLog(
            issue_id=id,
            action="Completion verified and approved. Issue Closed.",
            timestamp="Now",
            user=verify.manager_name
        )
        db.add(audit)
        
        feed = Feed(text=f"Issue {id} verified & successfully closed", type="teal", time="Now")
        db.add(feed)
        db.commit()
    elif verify.action == "rework":
        issue.status = "in_progress"
        audit = AuditLog(
            issue_id=id,
            action="Rework requested. Inspection verification failed alignment checks.",
            timestamp="Now",
            user=verify.manager_name
        )
        db.add(audit)
        
        feed = Feed(text=f"Rework ordered for issue {id}", type="red", time="Now")
        db.add(feed)
        db.commit()
        
    return {"success": True}

# Analytics Contractor matrix
@app.get(f"{settings.API_V1_STR}/analytics/contractors", response_model=List[schemas.ContractorPerformanceResponse])
def contractor_analytics(db: Session = Depends(get_db)):
    return get_contractor_performance(db)

# Audit log fetching
@app.get(f"{settings.API_V1_STR}/issues/{{id}}/audit")
def get_issue_audit(id: int, db: Session = Depends(get_db)):
    logs_db = db.query(AuditLog).filter(AuditLog.issue_id == id).order_by(AuditLog.id.desc()).all()
    progress_db = db.query(ProgressUpdate, User.name).join(User, ProgressUpdate.worker_id == User.id).filter(ProgressUpdate.issue_id == id).order_by(ProgressUpdate.id.desc()).all()
    
    logs = [{"id": l.id, "action": l.action, "timestamp": l.timestamp, "user": l.user} for l in logs_db]
    progress = [{
        "id": p.id,
        "worker_name": name,
        "timestamp": p.timestamp,
        "progress_pct": p.progress_pct,
        "comments": p.comments,
        "before_img": p.before_img,
        "after_img": p.after_img
    } for p, name in progress_db]
    
    return {"logs": logs, "progress": progress}

# Feed
@app.get(f"{settings.API_V1_STR}/feed", response_model=List[schemas.FeedResponse])
def get_feed(db: Session = Depends(get_db)):
    return db.query(Feed).order_by(Feed.id.desc()).limit(20).all()

# Analytics Charts
@app.get(f"{settings.API_V1_STR}/analytics")
def get_analytics(db: Session = Depends(get_db)):
    category_data = get_category_distribution(db)
    
    risk_trend = [
        {"day": 'Mon', "risk": 15},
        {"day": 'Tue', "risk": 22},
        {"day": 'Wed', "risk": 18},
        {"day": 'Thu', "risk": 35},
        {"day": 'Fri', "risk": 42},
        {"day": 'Sat', "risk": 28},
        {"day": 'Sun', "risk": 24, "isForecast": False},
        {"day": 'Tomorrow', "risk": 45, "isForecast": True, "riskHigh": 55, "riskLow": 35}
    ]
    
    risk_drivers = [
        {"label": 'Zone E Mechanical Delay', "impact": 'High', "zone": 'Zone E'},
        {"label": 'Zone C Rework Velocity', "impact": 'Medium', "zone": 'Zone C'},
        {"label": 'Reporting Lag Spike', "impact": 'Low', "zone": 'All'}
    ]
    
    workers = db.query(User).filter(User.role == "worker").limit(5).all()
    team_performance = []
    for w in workers:
        resolved = db.query(Issue).filter(Issue.assignee_id == w.id, Issue.status == "resolved").count()
        eff = 94 if "MEP" in w.name else (88 if "Electrical" in w.name else 82)
        team_performance.append({
            "name": w.name,
            "avatar": "".join([n[0] for n in w.name.split()[:2]]),
            "efficiency": eff,
            "resolved": resolved if resolved > 0 else 15
        })

    return {
        "impactScore": 85,
        "riskTrend": risk_trend,
        "riskDrivers": risk_drivers,
        "categoryData": category_data,
        "teamPerformance": team_performance
    }

# Daily log formatting (AI Whisper summary)
@app.post(f"{settings.API_V1_STR}/daily-logs")
def create_daily_log(log_in: schemas.DailyLogCreate, db: Session = Depends(get_db)):
    if not settings.GROQ_API_KEY:
        # Fallback if Groq API key is missing
        formatted = f"WORK COMPLETED: \n- {log_in.log_text}\n\nQUALITY CONTROL:\n- Sync verified against specs.\n\nSAFETY METRIC:\n- Handled within safe guidelines."
    else:
        try:
            worker = db.query(User).filter(User.id == log_in.worker_id).first()
            worker_name = worker.name if worker else "Contractor Team"
            
            headers = {"Authorization": f"Bearer {settings.GROQ_API_KEY}", "Content-Type": "application/json"}
            payload = {
                "model": "llama-3.3-70b-versatile",
                "messages": [
                    {
                        "role": "system",
                        "content": "You are a Senior Project Manager summarizing daily field work logs. Review the input provided by the site contractor and convert it into a highly professional daily progress report. Include sections: 1. WORK COMPLETED: Bulleted list of accomplishments. 2. QUALITY CONTROL: Inspection notes. 3. SAFETY METRIC: Safe conditions observed."
                    },
                    {"role": "user", "content": f"Contractor: {worker_name}\nRaw Logs: {log_in.log_text}"}
                ],
                "temperature": 0.3,
                "max_tokens": 300
            }
            res = requests.post("https://api.groq.com/openai/v1/chat/completions", headers=headers, json=payload)
            formatted = res.json()["choices"][0]["message"]["content"].strip()
        except Exception as e:
            formatted = f"WORK COMPLETED:\n- {log_in.log_text}\n\nQUALITY CONTROL:\n- Self-inspected by team."
            
    date_str = datetime.now().strftime("%Y-%m-%d")
    log = DailyLog(worker_id=log_in.worker_id, log_text=log_in.log_text, formatted_report=formatted, date=date_str)
    db.add(log)
    db.commit()
    
    return {"success": True, "formatted_report": formatted}

@app.get(f"{settings.API_V1_STR}/daily-logs", response_model=List[schemas.DailyLogResponse])
def get_daily_logs(db: Session = Depends(get_db)):
    logs_db = db.query(DailyLog, User.name, User.team).join(User, DailyLog.worker_id == User.id).order_by(DailyLog.id.desc()).all()
    
    logs = []
    for l, name, team in logs_db:
        logs.append(schemas.DailyLogResponse(
            id=l.id,
            worker_id=l.worker_id,
            worker_name=name,
            worker_team=team,
            log_text=l.log_text,
            formatted_report=l.formatted_report,
            date=l.date
        ))
    return logs

# Whisper Transcription
@app.post(f"{settings.API_V1_STR}/transcribe")
def transcribe_audio(audio: UploadFile = File(...)):
    if not settings.GROQ_API_KEY:
        return {"text": "Microphone audio successfully recorded (Groq transcription API key not configured)."}
        
    try:
        # Save temp file
        temp_filename = f"temp-{int(time.time())}.webm"
        with open(temp_filename, "wb") as buffer:
            buffer.write(audio.file.read())
            
        headers = {"Authorization": f"Bearer {settings.GROQ_API_KEY}"}
        
        with open(temp_filename, "rb") as f:
            files = {
                "file": (temp_filename, f, "audio/webm"),
                "model": (None, "whisper-large-v3"),
                "language": (None, "en"),
                "prompt": (None, "Construction site inspection report. Terms include: Zone A, Zone B, Zone C, Zone D, MEP, BIM, structural, rebar, concrete."),
                "temperature": (None, "0")
            }
            res = requests.post("https://api.groq.com/openai/v1/audio/transcriptions", headers=headers, files=files)
            
        os.remove(temp_filename)
        return {"text": res.json()["text"]}
    except Exception as e:
        if os.path.exists(temp_filename):
            os.remove(temp_filename)
        print("Transcription failed:", e)
        return {"text": "Acoustic anomaly detected. Cable anchors in structural anchorage require verification."}

# Vision Multimodal defect analysis
@app.post(f"{settings.API_V1_STR}/ai-report")
def ai_report(req: schemas.AIReportRequest):
    if not settings.GROQ_API_KEY:
        return {
            "risk": "High",
            "summary": "Concrete degradation and structural hairline fracturing detected in component.",
            "recommendation": "Perform compressive core test checks before loading bridge sections.",
            "tags": ["Safety", "Structural"],
            "team_rec": "Civil Team"
        }
        
    try:
        headers = {"Authorization": f"Bearer {settings.GROQ_API_KEY}", "Content-Type": "application/json"}
        
        system_prompt = (
            "You are a Senior Site Architect and Operations Lead. "
            "Analyze the data and respond with a JSON object containing: "
            "1. 'risk': Assess as 'Low', 'Medium', 'High', or 'Critical'. "
            "2. 'summary': Professional human-like observation of the issue. "
            "3. 'recommendation': Immediate tactical corrective action. "
            "4. 'tags': List of 1-3 tags from [Safety, Structural, MEP, Civil, Utilities, Schedule, Progress, Quality]. "
            "5. 'team_rec': Suggested contractor team from [Civil Team, Electrical Team, MEP Team, Safety Officer]."
        )
        
        messages = [
            {"role": "system", "content": system_prompt}
        ]
        
        user_content = []
        if req.description:
            user_content.append({"type": "text", "text": f"User Description: {req.description}"})
        if req.image:
            img_url = req.image if req.image.startswith("data:") else f"data:image/jpeg;base64,{req.image}"
            user_content.append({"type": "image_url", "image_url": {"url": img_url}})
            
        messages.append({"role": "user", "content": user_content if req.image else f"User Description: {req.description}"})
        
        payload = {
            "model": "meta-llama/llama-4-scout-17b-16e-instruct" if req.image else "llama-3.3-70b-versatile",
            "messages": messages,
            "response_format": {"type": "json_object"}
        }
        res = requests.post("https://api.groq.com/openai/v1/chat/completions", headers=headers, json=payload)
        ai_response = json.loads(res.json()["choices"][0]["message"]["content"])
        
        # Ensure all expected keys exist
        if "risk" not in ai_response:
            ai_response["risk"] = "Low"
        if "summary" not in ai_response:
            ai_response["summary"] = req.description or "Structural observation."
        if "recommendation" not in ai_response:
            ai_response["recommendation"] = "Verify structural parameters on site."
        
        # Sanitize team_rec if it is a list
        if "team_rec" in ai_response:
            if isinstance(ai_response["team_rec"], list):
                if ai_response["team_rec"]:
                    ai_response["team_rec"] = str(ai_response["team_rec"][0])
                else:
                    ai_response["team_rec"] = "Civil Team"
        else:
            ai_response["team_rec"] = "Civil Team"
            
        # Sanitize tags if it is a list
        if "tags" in ai_response:
            if isinstance(ai_response["tags"], list):
                ai_response["tags"] = ",".join(str(t) for t in ai_response["tags"])
        else:
            ai_response["tags"] = "Quality"
            
        return ai_response
    except Exception as e:
        print("AI Vision Report error:", e)
        return {
            "risk": "High",
            "summary": f"Visual defect: {req.description or 'structural check required'}",
            "recommendation": "Request structural engineer review on site immediately.",
            "tags": ["Structural"],
            "team_rec": "Civil Team"
        }

# Dynamic Morning site briefing
@app.get(f"{settings.API_V1_STR}/reports/summary")
def report_briefing(db: Session = Depends(get_db)):
    if not settings.GROQ_API_KEY:
        return {"summary": "Zone C remains the primary area of observation due to outstanding pipe alignment discrepancies."}
        
    try:
        metrics = get_metrics(db)
        issues = db.query(Issue).order_by(Issue.id.desc()).limit(30).all()
        
        context = f"""
        Current Site Status:
        - Open Issues: {metrics['openCount']}
        - Critical Risks: {metrics['criticalCount']}
        - Rework Rate: {metrics['reworkRate']}%
        
        Recent Issues:
        """
        for i in issues:
            context += f"\n- [{i.sevLabel}] {i.zone}: {i.raw_desc} ({i.status})"
            
        headers = {"Authorization": f"Bearer {settings.GROQ_API_KEY}", "Content-Type": "application/json"}
        payload = {
            "model": "llama-3.3-70b-versatile",
            "messages": [
                {
                    "role": "system",
                    "content": "You are a Veteran Project Director giving a morning site briefing. Summarize the overall site status in 2-3 professional, conversational sentences. Do not use bullet points or markdown bolding."
                },
                {"role": "user", "content": context}
            ],
            "temperature": 0.5,
            "max_tokens": 150
        }
        res = requests.post("https://api.groq.com/openai/v1/chat/completions", headers=headers, json=payload)
        return {"summary": res.json()["choices"][0]["message"]["content"].strip()}
    except Exception as e:
        return {"summary": "Structural reworks completed on East Anchorage. Schedule risk mitigation continues on West bridge deck sections."}

# Chatbot assistant
@app.post(f"{settings.API_V1_STR}/chat", response_model=schemas.ChatResponse)
def chatbot_chat(req: schemas.ChatMessage, db: Session = Depends(get_db)):
    if not settings.GROQ_API_KEY:
        return {"reply": "I am currently running in local offline demo mode. Please configure your GROQ_API_KEY to talk to the real-time AI Site Partner."}
        
    try:
        metrics = get_metrics(db)
        open_issues = db.query(Issue).filter(Issue.status != "resolved").all()
        
        site_context = f"""
        DASHBOARD CONTEXT:
        - Open Issues: {metrics['openCount']}
        - Critical Risks: {metrics['criticalCount']}
        - Rework Rate: {metrics['reworkRate']}%
        - Report Lag: {metrics['reportLag']}h
        
        DETAILED OPEN ISSUES:
        """
        for i in open_issues:
            site_context += f"\n- [{i.sevLabel}] {i.zone}: {i.raw_desc}"
            
        headers = {"Authorization": f"Bearer {settings.GROQ_API_KEY}", "Content-Type": "application/json"}
        payload = {
            "model": "llama-3.3-70b-versatile",
            "messages": [
                {
                    "role": "system",
                    "content": "You are the AI Site Partner for the AIInspect Pro Platform. Help project managers understand site progress and risks. Today is " + datetime.now().strftime("%Y-%m-%d")
                },
                {"role": "user", "content": f"CONTEXT:\n{site_context}\n\nUSER QUESTION: {req.message}"}
            ],
            "temperature": 0.7,
            "max_tokens": 400
        }
        res = requests.post("https://api.groq.com/openai/v1/chat/completions", headers=headers, json=payload)
        return {"reply": res.json()["choices"][0]["message"]["content"].strip()}
    except Exception as e:
        return {"reply": "I am experiencing problems connecting to my AI processor. Please try again in a few moments."}

# Photo capturing
@app.post(f"{settings.API_V1_STR}/capture")
def capture_photo(image_in: Dict[str, str]):
    image_data = image_in.get("image")
    if not image_data:
        raise HTTPException(status_code=400, detail="No image data provided")
        
    try:
        import base64
        import boto3
        
        # Robustly split base64 prefix if present (e.g. data:image/png;base64,...)
        if "," in image_data:
            base64_clean = image_data.split(",", 1)[1]
        else:
            base64_clean = image_data
            
        filename = f"capture-{int(time.time())}.jpg"
        file_bytes = base64.b64decode(base64_clean)
        
        if settings.AWS_ACCESS_KEY_ID and settings.AWS_BUCKET_NAME:
            s3 = boto3.client(
                "s3",
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                region_name=settings.AWS_REGION,
            )
            s3.put_object(
                Bucket=settings.AWS_BUCKET_NAME,
                Key=f"uploads/{filename}",
                Body=file_bytes,
                ContentType="image/jpeg"
            )
            file_url = f"https://{settings.AWS_BUCKET_NAME}.s3.{settings.AWS_REGION}.amazonaws.com/uploads/{filename}"
            return {"filename": file_url}
        else:
            # Create directory for local fallback
            uploads_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "public", "uploads")
            os.makedirs(uploads_dir, exist_ok=True)
            file_path = os.path.join(uploads_dir, filename)
            
            with open(file_path, "wb") as fh:
                fh.write(file_bytes)
                
            return {"filename": filename}
    except Exception as e:
        print("Capture failed:", e)
        raise HTTPException(status_code=500, detail=f"Image upload failed: {str(e)}")
# Export PDF using ReportLab
@app.get(f"{settings.API_V1_STR}/export/pdf")
def export_pdf(db: Session = Depends(get_db)):
    from io import BytesIO
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image, Table, TableStyle, PageBreak
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    import re
    import html
    
    # Fetch issues
    issues = db.query(Issue).order_by(Issue.status.asc(), Issue.id.desc()).all()
    
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=36, leftMargin=36, topMargin=36, bottomMargin=36)
    story = []
    
    styles = getSampleStyleSheet()
    
    # Primary Palette
    teal = colors.HexColor('#00A388')
    dark_slate = colors.HexColor('#1E2433')
    light_gray = colors.HexColor('#F3F4F6')
    text_dark = colors.HexColor('#111827')
    border_color = colors.HexColor('#E5E7EB')
    
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=20,
        textColor=teal,
        spaceAfter=4
    )
    
    meta_label_style = ParagraphStyle(
        'MetaLabel',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        textColor=dark_slate
    )
    
    meta_val_style = ParagraphStyle(
        'MetaVal',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        textColor=colors.HexColor('#4B5563')
    )
    
    h2_style = ParagraphStyle(
        'SectionHeader',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=12,
        textColor=dark_slate,
        spaceBefore=14,
        spaceAfter=8,
        keepWithNext=True
    )
    
    body_style = ParagraphStyle(
        'BodyDark',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        textColor=text_dark,
        spaceAfter=6
    )
    
    bullet_style = ParagraphStyle(
        'BulletText',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        textColor=colors.HexColor('#4B5563'),
        leftIndent=15,
        firstLineIndent=-10,
        spaceAfter=4
    )
    
    # Title Branding
    story.append(Paragraph("AIInspect Pro Enterprise Platform", title_style))
    story.append(Paragraph("<b>COMPLIANCE WORKFORCE & DETAILED DEFECT REPORT</b>", ParagraphStyle('Sub', parent=styles['Normal'], fontSize=8.5, textColor=colors.HexColor('#6B7280'), spaceAfter=12)))
    story.append(Spacer(1, 4))
    
    # Metadata Box
    date_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    meta_data = [
        [Paragraph("Project Name:", meta_label_style), Paragraph("Signature Bridge Construction", meta_val_style),
         Paragraph("Generated Date:", meta_label_style), Paragraph(date_str, meta_val_style)],
        [Paragraph("Lead Auditor:", meta_label_style), Paragraph("Sanjay V. (Project Manager)", meta_val_style),
         Paragraph("System Status:", meta_label_style), Paragraph("Real-Time Production Database", meta_val_style)]
    ]
    meta_table = Table(meta_data, colWidths=[80, 180, 90, 170])
    meta_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), light_gray),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('PADDING', (0,0), (-1,-1), 8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LINEBELOW', (0,0), (-1,-2), 0.5, border_color),
        ('BOX', (0,0), (-1,-1), 1, border_color)
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 12))
    
    # Statistics Snapshot
    total_obs = len(issues)
    active_risks = len([i for i in issues if i.status != 'resolved'])
    completed_tasks = len([i for i in issues if i.status == 'resolved'])
    
    stats_data = [
        [
            Paragraph("<b>Total Defect Logs</b>", ParagraphStyle('StatL', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=10, textColor=dark_slate, alignment=1)),
            Paragraph("<b>Active Risks In-Progress</b>", ParagraphStyle('StatL', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=10, textColor=dark_slate, alignment=1)),
            Paragraph("<b>Verified Closed Tasks</b>", ParagraphStyle('StatL', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=10, textColor=dark_slate, alignment=1))
        ],
        [
            Paragraph(f"<font size=16 color='#1F2937'><b>{total_obs}</b></font>", ParagraphStyle('StatV', parent=styles['Normal'], alignment=1)),
            Paragraph(f"<font size=16 color='#DE8B26'><b>{active_risks}</b></font>", ParagraphStyle('StatV', parent=styles['Normal'], alignment=1)),
            Paragraph(f"<font size=16 color='#00A388'><b>{completed_tasks}</b></font>", ParagraphStyle('StatV', parent=styles['Normal'], alignment=1))
        ]
    ]
    stats_table = Table(stats_data, colWidths=[174, 174, 174])
    stats_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.white),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('PADDING', (0,0), (-1,-1), 10),
        ('BOX', (0,0), (-1,-1), 1, border_color),
        ('BACKGROUND', (0,0), (-1,0), light_gray),
        ('LINEBELOW', (0,0), (-1,0), 1, border_color),
        ('INNERGRID', (0,0), (-1,-1), 0.5, border_color)
    ]))
    story.append(stats_table)
    story.append(Spacer(1, 16))
    
    # Issue Details
    story.append(Paragraph("Detailed Defect Records & Compliance History", h2_style))
    
    def clean_txt(raw):
        if not raw:
            return ""
        # Unescape HTML entities first
        s = html.unescape(raw)
        
        # Replace common tags with ReportLab paragraph markup tags
        s = re.sub(r'<strong>', '<b>', s, flags=re.IGNORECASE)
        s = re.sub(r'</strong>', '</b>', s, flags=re.IGNORECASE)
        s = re.sub(r'<em>', '<i>', s, flags=re.IGNORECASE)
        s = re.sub(r'</em>', '</i>', s, flags=re.IGNORECASE)
        
        # Standardize line breaks to ReportLab <br/> tags
        s = re.sub(r'<br\s*/?>', '<br/>', s, flags=re.IGNORECASE)
        
        # Remove any other HTML tags (like <span>, <div>, etc.)
        s = re.sub(r'<(?!/?(?:b|i|br)\b)[^>]+>', '', s, flags=re.IGNORECASE)
        
        # Escape raw ampersands (ReportLab requires & to be escaped as &amp;)
        s = re.sub(r'&(?!(?:amp|lt|gt|quot|apos);)', '&amp;', s)
        
        return s.strip()
        
    uploads_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "public", "uploads")
    
    for idx, issue in enumerate(issues):
        # Header for issue
        status_colors = {
            'pending_review': '#DE8B26',  # Amber
            'open': '#3E82C4',            # Blue
            'in_progress': '#3E82C4',     # Blue
            'waiting_for_approval': '#8B5CF6', # Purple
            'resolved': '#37A846'         # Green
        }
        status_color = status_colors.get(issue.status, '#4B5563')
        
        issue_title = f"<b>ISSUE #{issue.id}: {issue.zone or 'General Site Component'}</b>"
        issue_title_p = Paragraph(issue_title, ParagraphStyle(f'IT_{idx}', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=11, textColor=dark_slate))
        status_p = Paragraph(f"<b>{issue.status.upper()}</b>", ParagraphStyle(f'ST_{idx}', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=9, textColor=colors.HexColor(status_color), alignment=2))
        
        title_table = Table([[issue_title_p, status_p]], colWidths=[380, 142])
        title_table.setStyle(TableStyle([
            ('LINEBELOW', (0,0), (-1,-1), 1.5, colors.HexColor(status_color)),
            ('BOTTOMPADDING', (0,0), (-1,-1), 4),
            ('TOPPADDING', (0,0), (-1,-1), 8)
        ]))
        story.append(title_table)
        story.append(Spacer(1, 8))
        
        # Details grid
        user = db.query(models.User).filter(models.User.id == issue.assignee_id).first()
        assignee_name = user.name if user else "Unassigned"
        assignee_team = user.team if user else "None"
        
        grid_data = [
            [
                Paragraph("<b>Severity Level:</b>", meta_label_style), Paragraph(clean_txt(issue.severity), meta_val_style),
                Paragraph("<b>Deadline Target:</b>", meta_label_style), Paragraph(clean_txt(issue.deadline or 'None'), meta_val_style)
            ],
            [
                Paragraph("<b>Assigned Team:</b>", meta_label_style), Paragraph(assignee_team, meta_val_style),
                Paragraph("<b>Contractor Assignee:</b>", meta_label_style), Paragraph(assignee_name, meta_val_style)
            ],
            [
                Paragraph("<b>Category Area:</b>", meta_label_style), Paragraph(clean_txt(issue.category or 'Quality'), meta_val_style),
                Paragraph("<b>Reported By:</b>", meta_label_style), Paragraph(clean_txt(issue.author), meta_val_style)
            ]
        ]
        grid_table = Table(grid_data, colWidths=[90, 170, 100, 162])
        grid_table.setStyle(TableStyle([
            ('PADDING', (0,0), (-1,-1), 4),
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('LINEBELOW', (0,0), (-1,-1), 0.5, colors.HexColor('#F3F4F6'))
        ]))
        story.append(grid_table)
        story.append(Spacer(1, 8))
        
        # Description and recommendations
        story.append(Paragraph(f"<b>Description & Observation logs:</b>", meta_label_style))
        story.append(Paragraph(clean_txt(issue.desc), body_style))
        
        if issue.solution_rec:
            story.append(Paragraph(f"<b>AI Recommended Tactical Corrective Action:</b>", meta_label_style))
            story.append(Paragraph(clean_txt(issue.solution_rec), body_style))
            
        story.append(Spacer(1, 6))
        
        # Images Layout
        # Check for original image, before image, and after image
        progress_update = db.query(models.ProgressUpdate).filter(models.ProgressUpdate.issue_id == issue.id).order_by(models.ProgressUpdate.id.desc()).first()
        
        defect_img_name = issue.image
        before_img_name = progress_update.before_img if progress_update else None
        after_img_name = progress_update.after_img if progress_update else None
        
        image_cells = []
        label_cells = []
        
        col_widths = []
        
        # Helper to load and resize image flowables
        def load_pdf_img(name):
            if not name:
                return None
            p = os.path.join(uploads_dir, name)
            if os.path.exists(p):
                try:
                    return Image(p, width=150, height=112) # 4:3 Aspect ratio
                except Exception as e:
                    print("Failed to load PDF image", name, e)
            return None
            
        orig_flowable = load_pdf_img(defect_img_name)
        before_flowable = load_pdf_img(before_img_name)
        after_flowable = load_pdf_img(after_img_name)
        
        if orig_flowable:
            image_cells.append(orig_flowable)
            label_cells.append(Paragraph("<b>1. Logged Defect Photo</b>", ParagraphStyle('ImgLbl', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=8, textColor=colors.HexColor('#4B5563'), alignment=1)))
            col_widths.append(174)
        if before_flowable:
            image_cells.append(before_flowable)
            label_cells.append(Paragraph("<b>2. Before Repair Evidence</b>", ParagraphStyle('ImgLbl', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=8, textColor=colors.HexColor('#4B5563'), alignment=1)))
            col_widths.append(174)
        if after_flowable:
            image_cells.append(after_flowable)
            label_cells.append(Paragraph("<b>3. After Completion Evidence</b>", ParagraphStyle('ImgLbl', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=8, textColor=colors.HexColor('#4B5563'), alignment=1)))
            col_widths.append(174)
            
        if image_cells:
            # We construct a table containing the flowables
            img_table_data = [image_cells, label_cells]
            img_table = Table(img_table_data, colWidths=col_widths)
            img_table.setStyle(TableStyle([
                ('ALIGN', (0,0), (-1,-1), 'CENTER'),
                ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
                ('PADDING', (0,0), (-1,-1), 4),
                ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F9FAFB')),
                ('BOX', (0,0), (-1,-1), 1, border_color)
            ]))
            story.append(Spacer(1, 4))
            story.append(img_table)
            story.append(Spacer(1, 10))
            
        # Audit Logs bullet points
        audit_logs = db.query(models.AuditLog).filter(models.AuditLog.issue_id == issue.id).order_by(models.AuditLog.id.asc()).all()
        if audit_logs:
            story.append(Paragraph(f"<b>Compliance & Activity Logs:</b>", meta_label_style))
            for log in audit_logs:
                log_line = f"• <b>{log.timestamp} ({log.user}):</b> {clean_txt(log.action)}"
                story.append(Paragraph(log_line, bullet_style))
                
        story.append(Spacer(1, 12))
        
        # Add a page break if not last
        if idx < len(issues) - 1:
            story.append(PageBreak())
            
    doc.build(story)
    buffer.seek(0)
    
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=AIInspect_Pro_Inspection_Report.pdf"}
    )

# Export CSV
@app.get(f"{settings.API_V1_STR}/export/csv")
def export_csv(db: Session = Depends(get_db)):
    import csv
    import re
    from io import StringIO
    
    issues = db.query(Issue).order_by(Issue.status.asc(), Issue.id.desc()).all()
    
    # Use lineterminator='\n' to avoid double \r\r\n on Windows
    output = StringIO()
    writer = csv.writer(output, lineterminator='\n')
    
    # Write Header
    writer.writerow([
        "ID", "Zone", "Severity", "Status", "Description", "AI Recommendation", "Assigned Team", "Deadline", "Created By"
    ])
    
    def strip_html(text):
        """Strip all HTML tags (including those with attributes) from text."""
        if not text:
            return ""
        # Replace <br> variants with space
        text = re.sub(r'<br\s*/?>', ' ', text, flags=re.IGNORECASE)
        # Strip all remaining HTML tags
        text = re.sub(r'<[^>]+>', '', text)
        # Normalize whitespace
        text = re.sub(r'\s+', ' ', text).strip()
        return text
    
    # Write Rows
    for i in issues:
        clean_desc = strip_html(i.desc)
        writer.writerow([
            i.id, i.zone or "", i.sevLabel or "", i.status, clean_desc, i.solution_rec or "", i.team_rec or "", i.deadline or "", i.author or ""
        ])
        
    output.seek(0)
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": "attachment; filename=AIInspect_Pro_Inspection_Report.csv"}
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
