import { useState, useEffect, useRef } from 'react';
//import { apiManager } from '../services/ApiManager';
import { Personal, PersonalFormData } from '../types/Personal';
import { apiManager } from '../services/api/ApiManager';

const buildPayload = (data: PersonalFormData) => {
    const nombres_completos = `${data.nombres} ${data.ape_pat} ${data.ape_mat || ''}`.trim();
    return {
        nombres: data.nombres,
        ape_pat: data.ape_pat,
        ape_mat: data.ape_mat,
        documento: data.documento,
        tipo_doc: data.tipo_doc,
        puesto: data.puesto,
        area: data.area,
        sub_area: data.sub_area,
        usu_reg: data.usu_reg || 'admin',
        nombres_completos,
        tipo: data.tipo,
        fecha_ingreso: data.fecha_ingreso,
        guardia: data.guardia,
        sexo: data.sexo,
        estado_civil: data.estado_civil,
        celular: data.celular,
        correo: data.correo,
        fecha_nac: data.fecha_nac,
        sueldo: data.sueldo,
        comunero: data.comunero,
        direccion: data.direccion,
        distrito: data.distrito,
        provincia: data.provincia,
        departamento: data.departamento,
        es_padre: data.es_padre,
        nombre_conyuge: data.nombre_conyuge,
        dni_conyuge: data.dni_conyuge,
        regimen_pensionario: data.regimen_pensionario,
        n_cup: data.n_cup,
        cuenta_bancaria: data.cuenta_bancaria,
        cci: data.cci,
        banco: data.banco,
        tipo_contrato: data.tipo_contrato,
        sistema: data.sistema,
        numero_emergencia: data.numero_emergencia,
        contacto_emergencia: data.contacto_emergencia,
        estado: data.estado,
        id_empresa: data.id_empresa,
    };
};

// estadoInicial: 1 = activos, 0 = cesados, undefined = endpoint original (sin filtro de estado)
export const usePersonal = (estadoInicial?: 0 | 1) => {
    const [personal, setPersonal] = useState<Personal[]>([]);
    const [estado, setEstado] = useState<0 | 1 | undefined>(estadoInicial);
    const estadoRef = useRef<0 | 1 | undefined>(estadoInicial);

    // Si se pasa `estadoActual` se usa y se recuerda para las recargas posteriores
    const fetchAll = async (id_empresa: number, estadoActual: 0 | 1 | undefined = estadoRef.current) => {
        const resp = estadoActual === undefined
            ? await apiManager.personal.getAll({ id_empresa })
            : await apiManager.personal.getByEstado({ id_empresa, estado: estadoActual });
        // Estado y datos se actualizan juntos para que la tabla no pinte
        // los botones del estado nuevo sobre filas del estado anterior.
        estadoRef.current = estadoActual;
        setEstado(estadoActual);
        setPersonal(resp.data || resp || []);
    };
    const usuario = localStorage.getItem('usuarioCookie');
    const id_empresa_usuario = usuario ? JSON.parse(usuario).empresa_id : 0
    //console.log("id_empresa_usuario en usePersonal", id_empresa_usuario)
    useEffect(() => { fetchAll(id_empresa_usuario); }, []);

    const addPersonal = async (form: PersonalFormData) => {
        const payload = buildPayload(form);
        const response = await apiManager.personal.create(payload);
        await fetchAll(id_empresa_usuario);
        return response;
    };

    const updatePersonal = async (id: number, form: PersonalFormData) => {
        const payload = buildPayload(form);
        let payloadWithId = { ...payload, id };
        await apiManager.personal.update2(payloadWithId, id);
        await fetchAll(id_empresa_usuario);
    };

    const deletePersonal = async (id: number, data: any) => {
        await apiManager.personal.delete(id, data);
        await fetchAll(id_empresa_usuario);
    };

    const reactivarPersonal = async (personal_id: number) => {
        const response = await apiManager.personal.reactivar({ personal_id });
        await fetchAll(id_empresa_usuario);
        return response;
    };

    const getPersonalById = (id: number) => personal.find(p => p.id === id) || null;

    return { personal, estado, addPersonal, updatePersonal, deletePersonal, reactivarPersonal, getPersonalById, fetchAll };
};
