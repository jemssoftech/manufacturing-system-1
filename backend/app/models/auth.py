"""
Authentication and Authorization Models
Users, Roles, and Audit Logs
"""

from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base

class Role(Base):
    """User roles and permissions"""
    __tablename__ = "roles"
    
    role_id = Column(Integer, primary_key=True, index=True)
    role_name = Column(String(50), unique=True, nullable=False)
    permissions = Column(Text)  # JSON string of permissions
    description = Column(String(200))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    users = relationship("User", back_populates="role")

class User(Base):
    """System users"""
    __tablename__ = "users"
    
    user_id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(100), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(100))
    role_id = Column(Integer, ForeignKey("roles.role_id"), nullable=False)
    is_active = Column(Boolean, default=True)
    last_login = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    role = relationship("Role", back_populates="users")
    audit_logs = relationship("AuditLog", back_populates="user")

class AuditLog(Base):
    """System audit trail"""
    __tablename__ = "audit_logs"
    
    log_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    action = Column(String(100), nullable=False)
    entity_type = Column(String(50))  # e.g., "purchase_order", "sales_order"
    entity_id = Column(Integer)
    details = Column(Text)  # JSON string with additional details
    ip_address = Column(String(45))
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    
    # Relationships
    user = relationship("User", back_populates="audit_logs")
