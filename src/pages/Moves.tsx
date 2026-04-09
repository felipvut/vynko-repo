import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Plus } from "lucide-react";
import MoveFeed from "@/components/community/MoveFeed";
import CreateMoveSheet from "@/components/community/CreateMoveSheet";

const Moves = () => {
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="h-screen w-screen bg-black relative overflow-hidden">
      {/* Header overlay */}
      <div className="absolute top-0 left-0 right-0 z-40 flex items-center justify-between px-3 pt-3 bg-gradient-to-b from-black/60 to-transparent pb-8">
        <button onClick={() => navigate(-1)} className="p-2">
          <ChevronLeft className="h-6 w-6 text-white" />
        </button>
        <span className="text-white font-display font-bold text-lg">Moves</span>
        <button onClick={() => setShowCreate(true)} className="p-2">
          <Plus className="h-6 w-6 text-white" />
        </button>
      </div>

      <MoveFeed onRefresh={() => setRefreshKey(k => k + 1)} />

      <CreateMoveSheet
        open={showCreate}
        onOpenChange={setShowCreate}
        onCreated={() => setRefreshKey(k => k + 1)}
      />
    </div>
  );
};

export default Moves;
