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
 
 