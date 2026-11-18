import { apiManager } from '../api/ApiManager';

export interface MaestrosData {
    areas: Array<{ id: number; nombre: string }>;
    subAreas: Array<{ id: number; nombre: string }>;
    puestos: Array<{ id: number; nombre: string }>;
    empresas: Array<{ id: number; razonSocial: string }>;
    tipoPersonal: Array<{ id: number; nombre: string }>
    guardia: Array<{ id: number; nombre: string }>
    estadoCivil: Array<{ id: number; nombre: string }>
    sistemaTrabajo: Array<{ id: number; nombre: string }>
    regimenPensionario: Array<{ id: number; nombre: string }>
    tipoContrato: Array<{ id: number; nombre: string }>
    motivoCese: Array<{ id: number; nombre: string }>
    tipoDocumentos: Array<{ id: number; nombre: string }>
    tipoExamen: Array<{ id: number; nombre: string }>
    comunidades: Array<{ id: number; nombre: string }>
}

export const fetchMaestros = async (): Promise<MaestrosData> => {
    try {
        const [areasRes, subAreasRes, puestosRes, empresasRes, listaTipoPersonal, listaGuardia,
            listaEstadoCivil, listaSistemaTrabajo, listaRegimenPensionario, listaTipoContrato,
            listaMotivoCese, listaTipoExamenes, listaTipoDocumentos, listaComunidades] = await Promise.all([
                apiManager.maestro.listaAreas({}),
                apiManager.maestro.listaSubAreas({}),
                apiManager.maestro.listaPuestos({}),
                apiManager.maestro.listaEmpresas({}),
                apiManager.maestro.listaTipoPersonal({ "id_tabla": "1" }),
                apiManager.maestro.listaGuardia({ "id_tabla": "2" }),
                apiManager.maestro.listaEstadoCivil({ "id_tabla": "3" }),
                apiManager.maestro.listaSistemaTrabajo({ "id_tabla": "4" }),
                apiManager.maestro.listaRegimenPensionario({ "id_tabla": "5" }),
                apiManager.maestro.listaTipoContrato({ "id_tabla": "6" }),
                apiManager.maestro.listaMotivoCese({ "id_tabla": "7" }),
                apiManager.maestro.listaTipoExamenes({ "id_tabla": "8" }),
                apiManager.maestro.listaTipoDocumentos({}),
                //apiManager.maestro.listaComunidades({})
                []

            ]);

        return {
            areas: areasRes.data || [],
            subAreas: subAreasRes.data || [],
            puestos: puestosRes.data || [],
            empresas: empresasRes.data || [],
            tipoPersonal: listaTipoPersonal.data || [],
            guardia: listaGuardia.data || [],
            estadoCivil: listaEstadoCivil.data || [],
            sistemaTrabajo: listaSistemaTrabajo.data || [],
            regimenPensionario: listaRegimenPensionario.data || [],
            tipoContrato: listaTipoContrato.data || [],
            motivoCese: listaMotivoCese.data || [],
            tipoExamen: listaTipoExamenes.data || [],
            tipoDocumentos: listaTipoDocumentos.data || [],
            //comunidades: listaComunidades.data || [],
            comunidades: []
        };
    } catch (error) {
        console.error("Error al cargar maestros:", error);
        return {
            areas: [],
            subAreas: [],
            puestos: [],
            empresas: [],
            tipoPersonal: [],
            guardia: [],
            estadoCivil: [],
            sistemaTrabajo: [],
            regimenPensionario: [],
            tipoContrato: [],
            motivoCese: [],
            tipoExamen: [],
            tipoDocumentos: [],
            comunidades: []

        };
    }
};
