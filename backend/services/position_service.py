"""
services/position_service.py – Business logic for position management.
CRUD, status transitions, search-now trigger, interview kit.
Facade that delegates to specific modules under backend/services/positions/
"""
from typing import Optional

from backend.services.positions.crud import PositionCRUD
from backend.services.positions.pipeline import PositionPipeline
from backend.services.positions.approvals import PositionApprovals
from backend.services.positions.interviews import PositionInterviews

class PositionService(
    PositionCRUD,
    PositionPipeline,
    PositionApprovals,
    PositionInterviews
):
    pass
