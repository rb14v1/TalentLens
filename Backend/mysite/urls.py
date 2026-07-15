from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse


def healthz(request):
    return JsonResponse({"status": "ok"})


urlpatterns = [
    path('healthz', healthz, name='healthz'),
    path('admin/', admin.site.urls),
    path('api/', include('resume.urls')),  # <-- IMPORTANT
]
