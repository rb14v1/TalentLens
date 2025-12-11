from django.urls import path
from . import views
from . import job_views
from .views import (
    filter_resumes,
    view_resume,
    proxy_resume,
    extract_jd,
    jd_match,
    check_hashes,  # ADD THIS IMPORT
    fetch_all_resumes  # ADD THIS IMPORT (optional)
)
 
urlpatterns = [
    # ========== HOME ==========
    path('', views.home, name='home'),
   
    # ========== RESUME UPLOAD & MANAGEMENT ==========
    path('upload-resume/', views.ResumeUploadView.as_view(), name='upload_resume'),
    path('check-hashes/', check_hashes, name='check_hashes'),  # ✅ Hash-based dedup check
    path('resumes/', views.ResumeListView.as_view(), name='resume_list'),
    path('fetch-all-resumes/', fetch_all_resumes, name='fetch_all_resumes'),  # Optional: faster bulk fetch
    path('resumes/delete/<str:id>/', views.ResumeDeleteView.as_view(), name='resume_delete'),
   
    # ========== RESUME SEARCH & VIEWING ==========
    path('search/', views.ResumeSearchView.as_view(), name='resume_search'),
    path('view_resume/', views.view_resume, name='view-resume'),  # View + highlight
    path('proxy_resume/', proxy_resume, name='proxy_resume'),  # Proxy from S3
   
    # ========== ANALYTICS ==========
    path('analytics/', views.analytics_overview, name='analytics'),
    path('analytics/filter/', filter_resumes, name='analytics_filter'),
   
    # ========== JOB DESCRIPTION ==========
    path('jd-match/', views.jd_match, name='jd-match'),
    path('extract_jd/', extract_jd, name='extract_jd'),  # Extract JD keywords
    # path('jd_match/', jd_match, name='jd_match'),  # Match resumes to JD
    # Optional: Add these if using JobDescription model
    # path('jd/', views.job_description_list, name='job_description_list'),
    # path('jd/<int:jd_id>/', views.job_description_detail, name='job_description_detail'),
    # path('jd/draft/save/', views.save_jd_draft, name='save_jd_draft'),
    # path('jd/<int:jd_id>/publish/', views.publish_jd, name='publish_jd'),
    # path('jd/drafts/', views.get_drafts, name='get_drafts'),
    # path('jd/published/', views.get_published_jds, name='get_published_jds'),
   
 
    # ✅ NEW — JD DRAFT SYSTEM
    path('jd/draft/save/', job_views.save_jd_draft, name='save_jd_draft'),
    path('jd/drafts/<str:email>/', job_views.get_jd_drafts, name='get_jd_drafts'),
    path('jd/draft/delete/<int:draft_id>/', job_views.delete_jd_draft, name='delete_jd_draft'),
    path('jd/draft/publish/<int:draft_id>/', job_views.publish_jd, name='publish_jd'),
    path('jobs/view/<str:job_id>/', job_views.view_jd, name='view_jd'),
   
 
 
    # ========== UTILITIES ==========
    path('validate_word/', views.validate_word, name='validate_word'),
    path("register/", views.register_user),
    path("login/", views.login_user),
    path('jobs/save/', job_views.save_job_description, name='save-job'),
    path('jobs/delete/<str:job_id>/', job_views.delete_job_description, name='delete-job'),
    # path('jobs/list/', job_views.get_all_jobs, name='list-jobs'),
    path('user/profile/', views.user_profile, name='user-profile'),
    path('jobs/list/', job_views.list_jobs, name='list_jobs'),
    path('jobs/save/', job_views.publish_jd, name='publish_jd'),
    path('jobs/delete/<str:job_id>/', job_views.delete_jd, name='delete_jd'),
    path('jobs/status/<str:job_id>/', job_views.update_jd_status, name='update_jd_status'),
 
    path('jobs/download/<str:job_id>/', job_views.download_jd, name='download_jd'),
    path('jobs/view/<str:job_id>/', job_views.view_jd, name='view_jd'),
    path('jobs/status/<str:job_id>/', job_views.update_jd_status, name='update_jd_status'),
 
    path('jobs/details/<str:job_id>/', job_views.get_job_details, name='get_job_details'),
    path('jobs/update/<str:job_id>/', job_views.update_job_details, name='update_job_details'),
 
 
    # Add these lines in the urlpatterns list
 
# ========== CONFIRMED MATCHES (Resume Selection) ==========
path('confirmed-matches/save/', views.confirm_resume_matches, name='confirm_matches'),
path('confirmed-matches/list/', views.get_confirmed_matches, name='get_confirmed_matches'),
path('match_keywords/', views.match_resume_keywords, name='match_resume_keywords'),
path('confirmed-matches/stage/<int:match_id>/', job_views.update_hiring_stage, name='update_hiring_stage'),
]
 
 
 