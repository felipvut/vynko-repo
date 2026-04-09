import { useState, useEffect } from "react";

interface IBGEState {
  id: number;
  sigla: string;
  nome: string;
}

interface IBGECity {
  id: number;
  nome: string;
}

export const useBrazilLocations = (selectedState: string) => {
  const [states, setStates] = useState<IBGEState[]>([]);
  const [cities, setCities] = useState<IBGECity[]>([]);
  const [loadingStates, setLoadingStates] = useState(true);
  const [loadingCities, setLoadingCities] = useState(false);

  useEffect(() => {
    fetch("https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome")
      .then(r => r.json())
      .then(data => { setStates(data); setLoadingStates(false); })
      .catch(() => setLoadingStates(false));
  }, []);

  useEffect(() => {
    if (!selectedState) { setCities([]); return; }
    const uf = states.find(s => s.sigla === selectedState || s.nome === selectedState);
    if (!uf) return;

    setLoadingCities(true);
    fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf.id}/municipios?orderBy=nome`)
      .then(r => r.json())
      .then(data => { setCities(data); setLoadingCities(false); })
      .catch(() => setLoadingCities(false));
  }, [selectedState, states]);

  return { states, cities, loadingStates, loadingCities };
};
