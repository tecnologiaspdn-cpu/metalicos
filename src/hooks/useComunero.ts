import { useState, useEffect } from 'react';
//import { apiManager } from '../services/ApiManager';
import { Comunero, ComuneroFormData, Familiar, Parentesco } from '../types/Comunero';
import { apiManager } from '../services/api/ApiManager';

const toNumber = (v: any) => (v === '' || v == null || isNaN(Number(v)) ? 0 : Number(v));

const buildPayload = (data: ComuneroFormData) => {
    const sexoMap: Record<string, string> = { Masculino: 'M', Femenino: 'F' };
    return {
        comunidad_id: data.id_comunidad,
        caserio_id: data.caserio_id,
        estado_civil: data.estado_civil,
        nombres: data.nombres,
        ape_pat: data.ape_pat,
        ape_mat: data.ape_mat,
        fecha_nacimiento: data.fecha_nacimiento,
        sexo: data.sexo ? (sexoMap[data.sexo] ?? data.sexo) : data.sexo,
        fecha_admision: data.fecha_admision != null ? String(data.fecha_admision) : '',
        domicilio: data.domicilio,
        parcela: toNumber(data.parcela),
        ganado_mayor: toNumber(data.ganado_mayor),
        ganado_menor: toNumber(data.ganado_menor),
        dni: data.dni,
        usuario_creador: data.usuario_creador,
        usuario_modificador: data.usuario_creador
    };
};

const buildFamiliar = (f: Familiar) => ({
    nombres: f.nombres,
    ape_pat: f.ape_pat,
    ape_mat: f.ape_mat || null,
    parentesco_id: f.parentesco_id,
    edad_declarada: f.edad_declarada,
    sexo: f.sexo,
    discapacidad: !!f.discapacidad,
    detalle_discapacidad: f.discapacidad ? (f.detalle_discapacidad || null) : null,
    ocupacion_actividad: f.ocupacion_actividad || null,
    observacion: f.observacion || null,
});
export const useComunero = () => {
    const [comunero, setComunero] = useState<Comunero[]>([]);
    const [comunidades, setComunidades] = useState<any[]>([]);
    const [caserios, setCaserios] = useState<any[]>([]);
    const [parentescos, setParentescos] = useState<Parentesco[]>([]);

    const getParentescos = async () => {
        const res = await apiManager.comunero.listarParentescos();
        setParentescos(res.data || res || []);
    };

    const getFamiliares = async (comuneroId: number): Promise<Familiar[]> => {
        const res = await apiManager.comunero.listarFamiliares(comuneroId);
        return res?.data || [];
    };

    const addFamiliar = async (comuneroId: number, f: Familiar, usuario: string) =>
        apiManager.comunero.insertarFamiliar(comuneroId, { ...buildFamiliar(f), usuario });

    const updateFamiliar = async (comuneroId: number, f: Familiar, usuario: string) =>
        apiManager.comunero.actualizarFamiliar(comuneroId, f.id, { ...buildFamiliar(f), version: f.version, usuario });

    const deleteFamiliar = async (comuneroId: number, f: Familiar, usuario: string, motivo: string) =>
        apiManager.comunero.eliminarFamiliar(comuneroId, f.id, { version: f.version, usuario, motivo });

    const getComunidades = async () => {
        const res = await apiManager.maestro.listaComunidades({});
        setComunidades(res.data || res || []);
    };

    const getCaserios = async () => {
        const res = await apiManager.maestro.listaCaserios({});
        setCaserios(res.data || res || []);
    };

    const fetchAll = async (comunidad_id?: number) => {
        const payload = comunidad_id ? { comunidad_id } : {};
        const resp = await apiManager.comunero.getAll(payload);
        setComunero(resp.data || resp || []);
    };

    useEffect(() => {
        getComunidades();
        getCaserios();
        getParentescos();
    }, []);

    const addComunero = async (form: ComuneroFormData) => {
        const payload = { ...buildPayload(form), familiares: (form.familiares ?? []).map(buildFamiliar) };
        await apiManager.comunero.create(payload);
        await fetchAll(payload.comunidad_id);
    };

    const updateComunero = async (id: number, form: ComuneroFormData) => {
        const payload = buildPayload(form);
        let payloadWithId = { ...payload, id };
        await apiManager.comunero.update(payloadWithId, id);
        await fetchAll(payload.comunidad_id);
    };

    const deleteComunero = async (id: number, data: any) => {
        console.log("payload", data)
        await apiManager.comunero.delete(id, data);
        await fetchAll();
    };

    const getComuneroById = (id: number) => comunero.find(p => p.id === id) || null;

    return { comunero, addComunero, updateComunero, deleteComunero, getComuneroById, comunidades, caserios, fetchAll, parentescos, getFamiliares, addFamiliar, updateFamiliar, deleteFamiliar };
};
