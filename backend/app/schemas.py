from __future__ import annotations

from typing import Any, Optional
from pydantic import BaseModel, Field


class OrganizationInfo(BaseModel):
    id: str
    display_name: str
    dataset: str
    type: str
    uploaded: bool = False
    filename: Optional[str] = None
    rows: int = 0
    valid_rows: int = 0
    invalid_rows: int = 0


class UploadResponse(BaseModel):
    organization: str
    filename: str
    file_type: str
    rows: int = 0
    valid_rows: int = 0
    invalid_rows: int = 0
    status: str
    message: str


class RunSummary(BaseModel):
    status: str
    run_id: str
    organizations: int
    total_flows: int
    malicious_flows: int
    neural_only_flags: int
    fsra_flags: int
    alerts: int
    high_severity: int
    medium_severity: int
    low_severity: int
    rule_source: str
    threshold: float


class Alert(BaseModel):
    alert_id: str
    organization_id: str
    organization_name: str
    flow_index: int
    verdict: str
    severity: str
    neural_score: float
    neural_flag: bool
    fsra_flag: bool
    confidence_score: float
    fsra_rule_id: Optional[str] = None
    mitre_id: Optional[str] = None
    mitre_technique: Optional[str] = None
    attack_family: Optional[str] = None
    observed_organization: str
    contributing_organizations: list[str] = Field(default_factory=list)
    consensus_tier: Optional[str] = None
    conditions_satisfied: list[dict[str, Any]] = Field(default_factory=list)
    playbook: Optional[dict[str, Any]] = None
    feature_snapshot: dict[str, float] = Field(default_factory=dict)
    source_filename: str
    notes: list[str] = Field(default_factory=list)


class RunResponse(BaseModel):
    summary: RunSummary
    alerts: list[Alert]
    per_organization: list[dict[str, Any]]
    warnings: list[str] = Field(default_factory=list)
