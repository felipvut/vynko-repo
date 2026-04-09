import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Building2, Plus, Check } from "lucide-react";
import { toast } from "sonner";

interface GymSelectorProps {
  city: string;
  state: string;
  value: string;
  onChange: (name: string) => void;
}

const GymSelector = ({ city, state, value, onChange }: GymSelectorProps) => {
  const { user } = useAuth();
  const [gyms, setGyms] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSuggest, setShowSuggest] = useState(false);
  const [suggestedName, setSuggestedName] = useState("");
  const [suggesting, setSuggesting] = useState(false);

  useEffect(() => {
    if (city && state) {
      loadGyms();
    } else {
      setGyms([]);
    }
  }, [city, state]);

  const loadGyms = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("gyms")
      .select("id, name")
      .eq("city", city)
      .eq("state", state)
      .eq("is_approved", true)
      .order("name");
    setGyms(data || []);
    setLoading(false);
  };

  const suggestGym = async () => {
    if (!user || !suggestedName.trim()) return;
    setSuggesting(true);
    const { error } = await supabase.from("gym_suggestions").insert({
      name: suggestedName.trim(),
      city,
      state,
      suggested_by: user.id,
    });
    if (error) {
      toast.error("Erro ao sugerir academia");
    } else {
      toast.success("Academia sugerida! Aguardando aprovação.");
      onChange(suggestedName.trim());
      setShowSuggest(false);
      setSuggestedName("");
    }
    setSuggesting(false);
  };

  if (!city || !state) {
    return (
      <div className="space-y-2">
        <Label className="flex items-center gap-1"><Building2 className="h-3 w-3" /> Academia</Label>
        <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="Selecione estado e cidade primeiro" />
      </div>
    );
  }

  if (showSuggest) {
    return (
      <div className="space-y-2">
        <Label className="flex items-center gap-1"><Building2 className="h-3 w-3" /> Sugerir academia</Label>
        <Input
          value={suggestedName}
          onChange={(e) => setSuggestedName(e.target.value)}
          placeholder="Nome da academia"
          autoFocus
        />
        <div className="flex gap-2">
          <Button size="sm" className="flex-1" onClick={suggestGym} disabled={suggesting || !suggestedName.trim()}>
            <Check className="h-3 w-3 mr-1" /> Enviar sugestão
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowSuggest(false)}>
            Cancelar
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground">Sua sugestão será analisada e adicionada à lista.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-1"><Building2 className="h-3 w-3" /> Academia</Label>
      {gyms.length > 0 ? (
        <>
          <Select
            value={gyms.find(g => g.name === value)?.name || ""}
            onValueChange={(v) => {
              if (v === "__suggest__") {
                setShowSuggest(true);
              } else {
                onChange(v);
              }
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder={loading ? "Carregando..." : "Selecione sua academia"} />
            </SelectTrigger>
            <SelectContent className="max-h-60 bg-popover z-50">
              {gyms.map(g => (
                <SelectItem key={g.id} value={g.name}>{g.name}</SelectItem>
              ))}
              <SelectItem value="__suggest__">
                <span className="flex items-center gap-1 text-primary">
                  <Plus className="h-3 w-3" /> Minha academia não está na lista
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
          {value && !gyms.find(g => g.name === value) && (
            <p className="text-[10px] text-muted-foreground">Academia atual: {value} (não listada)</p>
          )}
        </>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Nenhuma academia cadastrada em {city}.</p>
          <Button size="sm" variant="outline" className="w-full" onClick={() => setShowSuggest(true)}>
            <Plus className="h-3 w-3 mr-1" /> Sugerir minha academia
          </Button>
          <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="Nome da academia" />
        </div>
      )}
    </div>
  );
};

export default GymSelector;
