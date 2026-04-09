import { useState, useEffect, useRef } from "react";
import { Search, Plus, X, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

export interface FoodItem {
  food_id: string;
  name: string;
  source: string;
  portion_grams: number;
  calories_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
}

interface FoodSearchProps {
  foods: FoodItem[];
  onFoodsChange: (foods: FoodItem[]) => void;
}

const sourceLabel: Record<string, string> = {
  usda: "USDA",
  tbca: "TBCA",
  openfoodfacts: "OFF",
};

const sourceColor: Record<string, string> = {
  usda: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  tbca: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  openfoodfacts: "bg-orange-500/20 text-orange-400 border-orange-500/30",
};

const FoodSearch = ({ foods, onFoodsChange }: FoodSearchProps) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [searching, setSearching] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.length < 2) { setResults([]); return; }
    const timer = setTimeout(async () => {
      setSearching(true);
      // Search local database first
      const { data: localData } = await supabase
        .from("foods" as any)
        .select("*")
        .ilike("name", `%${query}%`)
        .limit(20);
      
      const localResults = localData || [];
      setResults(localResults);
      setShowResults(true);

      // If few local results, fetch from external APIs and cache
      if (localResults.length < 5) {
        try {
          const [usdaRes, offRes] = await Promise.all([
            supabase.functions.invoke("import-foods", {
              body: { source: "usda", query, page_size: 25, page: 1 },
            }),
            supabase.functions.invoke("import-foods", {
              body: { source: "openfoodfacts", query, page_size: 25, page: 1 },
            }),
          ]);

          // Re-query local DB after import
          if ((usdaRes.data?.imported || 0) + (offRes.data?.imported || 0) > 0) {
            const { data: refreshed } = await supabase
              .from("foods" as any)
              .select("*")
              .ilike("name", `%${query}%`)
              .limit(30);
            setResults(refreshed || localResults);
          }
        } catch {
          // Silently fail — local results still shown
        }
      }
      setSearching(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const addFood = (food: any) => {
    onFoodsChange([...foods, {
      food_id: food.id,
      name: food.name,
      source: food.source || "tbca",
      portion_grams: food.serving_size_g || 100,
      calories_per_100g: Number(food.calories_per_100g),
      protein_per_100g: Number(food.protein_per_100g),
      carbs_per_100g: Number(food.carbs_per_100g),
      fat_per_100g: Number(food.fat_per_100g),
    }]);
    setQuery("");
    setShowResults(false);
  };

  const removeFood = (idx: number) => {
    onFoodsChange(foods.filter((_, i) => i !== idx));
  };

  const updatePortion = (idx: number, grams: number) => {
    onFoodsChange(foods.map((f, i) => i === idx ? { ...f, portion_grams: grams } : f));
  };

  const updateFoodName = (idx: number, name: string) => {
    onFoodsChange(foods.map((f, i) => i === idx ? { ...f, name } : f));
  };

  const calcNutrient = (food: FoodItem, per100g: number) =>
    Math.round((per100g * food.portion_grams) / 100);

  const totals = foods.reduce(
    (acc, f) => ({
      cal: acc.cal + calcNutrient(f, f.calories_per_100g),
      prot: acc.prot + calcNutrient(f, f.protein_per_100g),
      carbs: acc.carbs + calcNutrient(f, f.carbs_per_100g),
      fat: acc.fat + calcNutrient(f, f.fat_per_100g),
    }),
    { cal: 0, prot: 0, carbs: 0, fat: 0 }
  );

  return (
    <div className="space-y-2">
      {/* Food list */}
      {foods.length > 0 && (
        <div className="space-y-1.5">
          {foods.map((food, idx) => (
            <div key={idx} className="flex items-center gap-2 bg-secondary/30 rounded-lg px-2 py-1.5">
              {food.source && (
                <span className={`text-[8px] font-bold px-1 py-0.5 rounded border shrink-0 ${sourceColor[food.source] || "bg-muted text-muted-foreground border-border"}`}>
                  {sourceLabel[food.source] || food.source.toUpperCase()}
                </span>
              )}
              <Input
                value={food.name}
                onChange={e => updateFoodName(idx, e.target.value)}
                className="text-xs text-foreground flex-1 h-7 bg-transparent border-none px-1 focus-visible:ring-1"
                placeholder="Nome do alimento"
              />
              <Input
                type="number"
                value={food.portion_grams}
                onChange={e => updatePortion(idx, parseInt(e.target.value) || 0)}
                className="w-16 h-7 text-xs bg-background/50 text-center px-1"
              />
              <span className="text-[10px] text-muted-foreground">g</span>
              <span className="text-[10px] text-primary font-medium w-12 text-right">
                {calcNutrient(food, food.calories_per_100g)}cal
              </span>
              <button onClick={() => removeFood(idx)} className="text-destructive shrink-0">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          {/* Totals */}
          <div className="flex justify-between text-[10px] text-muted-foreground px-2 pt-1 border-t border-border/30">
            <span className="font-medium text-foreground">Total:</span>
            <span>{totals.cal} kcal</span>
            <span>P: {totals.prot}g</span>
            <span>C: {totals.carbs}g</span>
            <span>G: {totals.fat}g</span>
          </div>
        </div>
      )}

      {/* Search */}
      <div ref={wrapperRef} className="relative">
        <div className="relative">
          {searching ? (
            <Loader2 className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-primary animate-spin" />
          ) : (
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          )}
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onFocus={() => results.length > 0 && setShowResults(true)}
            placeholder="Buscar alimento (USDA, TBCA, Open Food Facts)..."
            className="pl-7 h-8 text-xs bg-secondary/50"
          />
        </div>
        {showResults && results.length > 0 && (
          <div className="absolute z-50 top-full mt-1 w-full bg-card border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
            {results.map((food: any) => (
              <button
                key={food.id}
                onClick={() => addFood(food)}
                className="w-full px-3 py-2 text-left hover:bg-secondary/50 flex items-center justify-between text-xs border-b border-border/20 last:border-0"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className={`text-[8px] font-bold px-1 py-0.5 rounded border shrink-0 ${sourceColor[food.source] || "bg-muted text-muted-foreground border-border"}`}>
                    {sourceLabel[food.source] || "?"}
                  </span>
                  <span className="text-foreground truncate">{food.name}</span>
                  {food.brand && <span className="text-[10px] text-muted-foreground">({food.brand})</span>}
                </div>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground shrink-0">
                  <span>{Number(food.calories_per_100g)}cal</span>
                  <Plus className="h-3 w-3 text-primary" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FoodSearch;
