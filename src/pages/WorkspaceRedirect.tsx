import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";

export default function WorkspaceRedirect() {
  const { workspaceId } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    if (workspaceId) {
      navigate(`/creative?workspace=${workspaceId}`, { replace: true });
    } else {
      navigate("/creative", { replace: true });
    }
  }, [workspaceId, navigate]);

  return null;
}
