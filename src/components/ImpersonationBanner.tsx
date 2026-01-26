import { useImpersonation } from "@/contexts/ImpersonationContext";
import { Button } from "@/components/ui/button";
import { UserX, Eye } from "lucide-react";

export const ImpersonationBanner = () => {
  const { isImpersonating, impersonatedUser, stopImpersonation } = useImpersonation();

  if (!isImpersonating || !impersonatedUser) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-amber-500 text-amber-950 py-2 px-4 flex items-center justify-between shadow-lg">
      <div className="flex items-center gap-3">
        <Eye className="w-5 h-5" />
        <span className="font-medium">
          Viewing as: <strong>{impersonatedUser.email}</strong>
          {impersonatedUser.fullName && (
            <span className="opacity-75"> ({impersonatedUser.fullName})</span>
          )}
        </span>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={stopImpersonation}
        className="bg-amber-600 border-amber-700 text-white hover:bg-amber-700 hover:text-white"
      >
        <UserX className="w-4 h-4 mr-2" />
        Stop Impersonating
      </Button>
    </div>
  );
};
