"""
services/position_service.py – Business logic for position management.
CRUD, status transitions, search-now trigger, interview kit.

INTENTIONAL THIN FACADE (E6, verified 2026-06-13): the migration into
backend/services/positions/* is complete. `PositionService` is the stable public
entry point that routers/tests import; it carries no logic of its own and exists
only to compose the decomposed mixins below. Add new behaviour to the relevant
`positions/*` module, not here.
"""

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
    """Composed facade over the positions/* service modules. No logic here by design."""
    pass
