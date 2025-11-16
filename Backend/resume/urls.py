from django.urls import path
from . import views
from .views import filter_resumes, view_resume, proxy_resume, extract_jd, jd_match

urlpatterns = [
    # Home (optional)
    path('', views.home),

    # Upload / List / Search
    path('upload-resume/', views.ResumeUploadView.as_view(), name='upload_resume'),
    path('resumes/', views.ResumeListView.as_view(), name='resume_list'),
    path('search/', views.ResumeSearchView.as_view(), name='resume_search'),

    # Analytics
    path("analytics/", views.analytics_overview, name="analytics"),
    path("analytics/filter/", filter_resumes, name="analytics_filter"),

    # Delete Resume
    path('resumes/delete/<str:id>/', views.ResumeDeleteView.as_view(), name='resume_delete'),

    # PDF Viewer API (IMPORTANT)
    path('view_resume/', view_resume, name='view_resume'),

    # Proxy PDF from S3
    path('proxy_resume/', proxy_resume, name='proxy_resume'),

    # Word validator
    path('validate_word/', views.validate_word, name='validate_word'),

    path('extract_jd/', extract_jd, name='extract_jd'),          
    path('jd_match/', jd_match, name='jd_match'),
]
