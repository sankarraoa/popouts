"""SQLAlchemy models - portable for SQLite and PostgreSQL."""
from typing import Optional

from sqlalchemy import String, Text, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class License(Base):
    __tablename__ = "licenses"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    license_key: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    expiry_date: Mapped[str] = mapped_column(String(50), nullable=False)
    created_at: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="active", nullable=False)

    __table_args__ = (UniqueConstraint("email", "license_key", name="uq_licenses_email_key"),)


class Installation(Base):
    __tablename__ = "installations"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    installation_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    activated_at: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    last_seen: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    __table_args__ = (
        UniqueConstraint("email", "installation_id", name="uq_installations_email_inst"),
    )


class ApiRequest(Base):
    __tablename__ = "api_requests"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    timestamp: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    service: Mapped[str] = mapped_column(String(50), nullable=False)
    endpoint: Mapped[str] = mapped_column(String(255), nullable=False)
    method: Mapped[str] = mapped_column(String(10), nullable=False)
    user_identifier: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    request_body: Mapped[Optional[str]] = mapped_column(String(10000), nullable=True)
    response_body: Mapped[Optional[str]] = mapped_column(String(10000), nullable=True)
    status_code: Mapped[Optional[int]] = mapped_column(nullable=True)
    duration_ms: Mapped[Optional[int]] = mapped_column(nullable=True)


class ExtractActionItem(Base):
    """Tracks LLM extract-actions API calls for debugging and audit."""

    __tablename__ = "extract_action_items"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    correlation_id: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    created_at: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    updated_at: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    license_key: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    installation_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)

    input_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    output_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    input_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, unique=True, index=True)

    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    http_status_code: Mapped[Optional[int]] = mapped_column(nullable=True)
    duration_ms: Mapped[Optional[int]] = mapped_column(nullable=True)
