export interface Personal {
    id?: number;
    nombres?: string;
    ape_pat?: string;
    ape_mat?: string | null;
    documento?: string;
    tipo_doc?: number;
    puesto?: number;
    puesto_nombre?: string;
    area?: number;
    area_nombre?: string;
    sub_area?: number;
    usu_reg?: string;
    nombres_completos?: string;
    tipo?: string; // Ej?:"Empleado"
    fecha_ingreso?: string; // "DD/MM/YYYY"
    guardia?: string; // Ej?:"Noche"
    sexo?: 'Masculino' | 'Femenino';
    estado_civil?: 'Soltero' | 'Casado' | 'Divorciado' | 'Viudo' | string;
    celular?: string;
    correo?: string;
    fecha_nac?: string; // "DD/MM/YYYY"
    sueldo?: number;
    comunero?: 'Sí' | 'No' | string;
    direccion?: string;
    distrito?: string;
    provincia?: string;
    departamento?: string;
    es_padre?: 'Sí' | 'No' | string;
    nombre_conyuge?: string | null;
    dni_conyuge?: string | null;
    regimen_pensionario?: string; // "ONP" | "AFP" | ...
    n_cup?: string;
    cuenta_bancaria?: string;
    cci?: string;
    banco?: string;
    tipo_contrato?: string; // "Indeterminado", etc.
    sistema?: string; // "Planilla", etc.
    numero_emergencia?: string;
    contacto_emergencia?: string;
    estado?: '0' | '1';
    id_empresa?: number | null;
}

export interface PersonalFormData
    extends Omit<
        Personal,
        'id' | 'nombres_completos' | 'usu_reg'
    > {
    usu_reg?: string; //  (ej?:"admin")
}
