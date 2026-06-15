"""
API Routes Package Initialization
"""

from app.api.routes import (
    auth,
    procurement,
    inventory,
    production,
    quality,
    sales,
    reports
)

__all__ = [
    "auth",
    "procurement",
    "inventory",
    "production",
    "quality",
    "sales",
    "reports"
]
