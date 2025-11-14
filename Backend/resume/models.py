from django.db import models

class Resume(models.Model):
    name = models.CharField(max_length=255)
    email = models.EmailField(unique=False, blank=True, null=True)
    contact = models.CharField(max_length=20, blank=True, null=True)
    s3_link = models.URLField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name or "Unnamed Resume"
