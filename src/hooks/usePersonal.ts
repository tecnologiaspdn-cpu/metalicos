import { useState, useEffect } from 'react';
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
        estado: data.estado
    };
};

export const usePersonal = () => {
    const [personal, setPersonal] = useState<Personal[]>([]);

    const fetchAll = async () => {
        const resp = await apiManager.personal.getAll();
        // Ajusta según tu backend (data path):
        setPersonal(resp.data || resp || []);
    };

    useEffect(() => { fetchAll(); }, []);

    const addPersonal = async (form: PersonalFormData) => {
        const payload = buildPayload(form);
        await apiManager.personal.create(payload);
        await fetchAll();
    };

    const updatePersonal = async (id: number, form: PersonalFormData) => {
        const payload = buildPayload(form);
        await apiManager.personal.update(payload, id);
        await fetchAll();
    };

    const deletePersonal = async (id: number) => {
        await apiManager.personal.delete(id);
        await fetchAll();
    };

    const getPersonalById = (id: number) => personal.find(p => p.id === id) || null;

    return { personal, addPersonal, updatePersonal, deletePersonal, getPersonalById };
};
