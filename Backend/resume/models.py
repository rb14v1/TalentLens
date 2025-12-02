from django.db import models
from django.contrib.auth.hashers import make_password, check_password
 
# ===============================
# Resume (QDRANT) — no PostgreSQL table
# ===============================
class Resume(models.Model):
    name = models.CharField(max_length=255)
    email = models.EmailField(unique=False, blank=True, null=True)
    contact = models.CharField(max_length=20, blank=True, null=True)
    s3_link = models.URLField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
 
    class Meta:
        managed = False   # <- DO NOT create table
        db_table = 'resume_qdrant'  # <- dummy table name
 
    def __str__(self):
        return self.name or "Unnamed Resume"
 
 
# ===============================
# AppUser — PostgreSQL table
# ===============================
class AppUser(models.Model):
    ROLE_CHOICES = [
        ('manager', 'Manager'),
        ('recruiter', 'Recruiter'),
        ('hiring_manager', 'Hiring Manager'),
    ]
 
    DEPARTMENT_CHOICES = [
        ('engineering_it', 'Engineering/IT'),
        ('hr', 'Human Resources'),
        ('sales_marketing', 'Sales and Marketing'),
        ('finance_accounting', 'Finance and Accounting'),
    ]
 
    name = models.CharField(max_length=255)
    email = models.EmailField(unique=True)
    password = models.CharField(max_length=255)
    role = models.CharField(max_length=50, choices=ROLE_CHOICES)
    department = models.CharField(max_length=50, choices=DEPARTMENT_CHOICES, null=True, blank=True)
 
    # ⭐ Stores base64 profile image
    profile_image = models.TextField(null=True, blank=True)
 
    created_at = models.DateTimeField(auto_now_add=True)
 
    def save(self, *args, **kwargs):
        # hash only once
        if not self.password.startswith("pbkdf2_"):
            self.password = make_password(self.password)
        super().save(*args, **kwargs)
 
    def check_password(self, raw_password):
        return check_password(raw_password, self.password)
 
    def __str__(self):
        return f"{self.name} ({self.role})"
 
 
# ===============================
# ⭐ NEW — JDDraft Model
# ===============================
class JDDraft(models.Model):
    STATUS_CHOICES = [
        ("draft", "Draft"),
        ("published", "Published"),
    ]
 
    user = models.ForeignKey(AppUser, on_delete=models.CASCADE, related_name="jd_drafts")
    title = models.CharField(max_length=255)
    data = models.JSONField()  # stores the entire JD structure
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default="draft")
 
    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)
 
    def __str__(self):
        return f"JD Draft: {self.title} ({self.status})"
 
# Add this at the end of your models.py file
 
class ConfirmedMatch(models.Model):
    """
    Stores recruiter-confirmed resume matches for a specific JD.
    Links: Job Description -> Selected Resumes -> Hiring Manager
    """
    jd_id = models.CharField(max_length=255)  # Job Description ID from Qdrant
    jd_title = models.CharField(max_length=255)
    jd_department = models.CharField(max_length=100)
   
    # Resume details (since resumes are in Qdrant, we store key info)
    resume_id = models.CharField(max_length=255)  # Qdrant point ID
    candidate_name = models.CharField(max_length=255)
    candidate_email = models.EmailField()
    match_score = models.CharField(max_length=10, blank=True, null=True)  # e.g., "58%"
    matched_skills = models.JSONField(default=list)  # List of matched skills
    experience_years = models.IntegerField(default=0)
   
    # Metadata
    confirmed_by = models.ForeignKey(AppUser, on_delete=models.CASCADE, related_name="confirmed_matches")
    confirmed_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=50, default="pending")  # pending, reviewed, shortlisted, rejected
   
    # S3 link to resume PDF
    resume_s3_url = models.URLField(blank=True, null=True)
    resume_file_name = models.CharField(max_length=500, blank=True, null=True)
   
    class Meta:
        db_table = 'confirmed_matches'
        unique_together = ('jd_id', 'resume_id')  # Prevent duplicate assignments
   
    def __str__(self):
        return f"{self.candidate_name} -> {self.jd_title}"
    hiring_stage = models.CharField(max_length=100, default="Applied")
 
 