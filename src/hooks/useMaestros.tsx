import { useState, useEffect } from 'react';
//import { apiManager } from '../services/ApiManager'; 
import { apiManager } from '../services/api/ApiManager';



export const useMaestros = () => {
    const [empresas, setEmpresas] = useState<any[]>([]);
    const [areas, setAreas] = useState<any[]>([]);
    const [subAreas, setSubAreas] = useState<any[]>([]);
    const [puestos, setPuestos] = useState<any[]>([]);
    const [tiposSalidas, setTiposSalidas] = useState<any[]>([]);
    const [tiposEntradas, setTiposEntradas] = useState<any[]>([]);
    const getEmpresas = async () => {
        const empresas = await apiManager.maestro.listaEmpresas({});
        // Ajusta según tu backend (data path):
        setEmpresas(empresas.data || empresas || []);
    };
    const getAreas = async () => {
        const areas = await apiManager.maestro.listaAreas({});
        // Ajusta según tu backend (data path):
        setAreas(areas.data || areas || []);
    }
    const getSubAreas = async () => {
        const subAreas = await apiManager.maestro.listaSubAreas({});
        // Ajustaccording to your backend (data path):
        setSubAreas(subAreas.data || subAreas || []);
    }
    const getPuestos = async () => {
        const puestos = await apiManager.maestro.listaPuestos({});
        // Ajustaccording to your backend (data path):
        setPuestos(puestos.data || puestos || []);
    }
    const getTiposSalidas = async () => {
        //const tiposSalidas = await apiManager.maestro.listaTiposSalidas({});
        const tiposSalidas = await apiManager.maestro.listaTipoMovimientos({ "id_tipo": "S" });
        // Ajustaccording to your backend (data path):
        setTiposSalidas(tiposSalidas.data || tiposSalidas || []);
    }
    const getTiposEntradas = async () => {
        //const tiposEntradas = await apiManager.maestro.listaTiposEntradas({});
        const tiposEntradas = await apiManager.maestro.listaTipoMovimientos({ "id_tipo": "I" });
        // Ajustaccording to your backend (data path):
        setTiposEntradas(tiposEntradas.data || tiposEntradas || []);
    }
    useEffect(() => {
        getEmpresas();
        getAreas();
        getSubAreas()
        getPuestos()
        getTiposSalidas()
        getTiposEntradas()
    }, []);



    //const getPersonalById = (id: number) => personal.find(p => p.id === id) || null;

    return { empresas, areas, subAreas, puestos, tiposSalidas, tiposEntradas };
};
