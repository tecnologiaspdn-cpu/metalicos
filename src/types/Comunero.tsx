export interface Familiar {
    id?: number
    version?: number
    nombres: string
    ape_pat: string
    ape_mat?: string | null
    parentesco_id: number | null
    parentesco?: string
    edad_declarada: number | null
    sexo: 'M' | 'F'
    discapacidad: boolean
    detalle_discapacidad?: string | null
    ocupacion_actividad?: string | null
    observacion?: string | null
}

export interface Parentesco {
    id: number
    nombre?: string
    valor?: string
    descripcion?: string
}

export interface Comunero {
    id?: number
    id_comunidad?: number
    caserio_id?: number | null
    estado_civil?: string | null
    nombres?: string
    ape_pat?: string
    ape_mat?: string
    fecha_nacimiento?: string
    sexo?: string
    fecha_admision?: string
    domicilio?: string
    carga_familiar?: string
    parcela?: string
    ganado_mayor?: string
    ganado_menor?: string
    dni?: string
    total_familiares?: number
}
export interface ComuneroFormData
    extends Omit<
        Comunero,
        'id' | 'nombres_completos' | 'usu_reg'
    > {
    usuario_creador?: string
    /** Sólo se envía al crear; al editar los familiares se gestionan por sus propios endpoints. */
    familiares?: Familiar[]
}
