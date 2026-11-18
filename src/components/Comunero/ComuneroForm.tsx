import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Form } from 'devextreme-react/form';
import { Button } from 'devextreme-react/button';
import TextArea from 'devextreme-react/text-area';
import { Comunero, ComuneroFormData, Familiar, Parentesco } from '../../types/Comunero';
import FamiliaresSection from './FamiliaresSection';
import { custom } from 'devextreme/ui/dialog';
import ValidationGroup from 'devextreme/ui/validation_group';
import notify from 'devextreme/ui/notify';
interface ComuneroFormProps {
    comunero?: Comunero;
    onSubmit: (data: ComuneroFormData) => void;
    onCancel: () => void;
    isEditing: boolean;
    listaComunidades: Array<any>;
    listaCaserios: Array<any>;
    listaEstadoCivil: Array<any>;
    parentescos: Parentesco[];
    getFamiliares: (comuneroId: number) => Promise<Familiar[]>;
    addFamiliar: (comuneroId: number, f: Familiar, usuario: string) => Promise<any>;
    updateFamiliar: (comuneroId: number, f: Familiar, usuario: string) => Promise<any>;
    deleteFamiliar: (comuneroId: number, f: Familiar, usuario: string, motivo: string) => Promise<any>;
}

const sexoReverseMap: Record<string, string> = { M: 'Masculino', F: 'Femenino' };

const toInitial = (p?: Comunero): ComuneroFormData => ({
    id_comunidad: (p as any)?.comunidad_id ?? p?.id_comunidad ?? undefined,
    caserio_id: p?.caserio_id ?? null,
    estado_civil: p?.estado_civil ?? null,
    nombres: p?.nombres || '',
    ape_pat: p?.ape_pat || '',
    ape_mat: p?.ape_mat || '',
    sexo: (p?.sexo ? (sexoReverseMap[p.sexo] ?? p.sexo) : 'Masculino') as any,
    fecha_nacimiento: p?.fecha_nacimiento || '',
    fecha_admision: p?.fecha_admision || '',
    parcela: p?.parcela || '',
    ganado_mayor: p?.ganado_mayor || '',
    ganado_menor: p?.ganado_menor || '',
    domicilio: p?.domicilio || '',
    dni: p?.dni || '',
});

const ComuneroForm: React.FC<ComuneroFormProps> = ({
    comunero,
    onSubmit,
    onCancel,
    isEditing,
    listaComunidades,
    listaCaserios,
    listaEstadoCivil,
    parentescos,
    getFamiliares,
    addFamiliar,
    updateFamiliar,
    deleteFamiliar,
}) => {
    const [uploaderKey, setUploaderKey] = useState(0);
    const formRef = useRef<any>(null);
    const [formData, setFormData] = useState<ComuneroFormData>(toInitial(comunero));
    const [familiares, setFamiliares] = useState<Familiar[]>([]);
    const [loadingFamiliares, setLoadingFamiliares] = useState(false);
    useEffect(() => {
        setFormData(toInitial(comunero));
    }, [comunero]);
    const comuneroId = isEditing && comunero?.id != null ? Number(comunero.id) : null;
    const cargarFamiliares = async (id: number) => {
        setLoadingFamiliares(true);
        try {
            setFamiliares(await getFamiliares(id));
        } catch {
            notify('No se pudo cargar la información familiar.', 'error', 3000);
        } finally {
            setLoadingFamiliares(false);
        }
    };
    useEffect(() => {
        if (comuneroId !== null) cargarFamiliares(comuneroId);
        else setFamiliares([]);
    }, [comuneroId]);
    const required = (msg: string) => ({ type: 'required' as const, message: msg });
    const usuarioRaw = localStorage.getItem("usuarioCookie");
    //console.log("usuarioRaw", usuarioRaw)
    const usuarioParsed = usuarioRaw ? JSON.parse(usuarioRaw) : {};
    const usuario = usuarioParsed.username || 'admin';

    // Edición: cada cambio se guarda al instante contra los endpoints de familiares.
    // Alta: se acumulan en memoria y viajan con el comunero.
    const handleSaveFamiliar = async (f: Familiar, index: number | null) => {
        if (comuneroId !== null) {
            const res = f.id != null
                ? await updateFamiliar(comuneroId, f, usuario)
                : await addFamiliar(comuneroId, f, usuario);
            if (res?.code && res.code >= 400) throw new Error(res.message);
            await cargarFamiliares(comuneroId);
            return;
        }
        setFamiliares(prev => index === null ? [...prev, f] : prev.map((x, i) => (i === index ? f : x)));
    };

    const handleDeleteFamiliar = (f: Familiar, index: number) => {
        if (comuneroId === null) {
            setFamiliares(prev => prev.filter((_, i) => i !== index));
            return;
        }
        const dialog = custom({
            title: 'Dar de baja familiar',
            messageHtml: `
                <div class="space-y-2">
                    <p>¿Dar de baja a <strong>${f.nombres} ${f.ape_pat}</strong>?</p>
                    <label class="block text-sm font-medium mt-2">Motivo:</label>
                    <textarea id="motivoFamiliarInput" rows="3" class="w-full border rounded px-2 py-1">Ya no convive con el comunero</textarea>
                </div>`,
            buttons: [
                {
                    text: 'Dar de baja',
                    type: 'danger',
                    stylingMode: 'contained',
                    onClick: async () => {
                        const el = document.getElementById('motivoFamiliarInput') as HTMLTextAreaElement;
                        try {
                            await deleteFamiliar(comuneroId, f, usuario, el?.value.trim() || '');
                            await cargarFamiliares(comuneroId);
                        } catch {
                            notify('No se pudo dar de baja al familiar.', 'error', 3000);
                        }
                        return true;
                    },
                },
                { text: 'Cancelar', type: 'normal', stylingMode: 'outlined', onClick: () => false },
            ],
        });
        dialog.show();
    };

    const validateFormData = (data: ComuneroFormData): boolean => {
        const requiredFields: (keyof ComuneroFormData)[] = [
            'id_comunidad',
            'nombres',
            'dni',
            'ape_pat',
            //'ape_mat', 
            'fecha_nacimiento',
            'fecha_admision',
        ];
        for (const field of requiredFields) {
            const value = data[field];
            if (
                value === undefined ||
                value === null ||
                (typeof value === 'string' && value.trim() === '') ||
                (typeof value === 'number' && isNaN(value))
            ) {
                console.warn(`Campo requerido vacío: ${field}`);
                return false;
            }
        }

        return true;
    };

    const handleSubmit = async (e: any) => {
        //e.preventDefault(); 
        console.log(validateFormData(formData))
        if (!validateFormData(formData)) {
            //alert('Por favor completa todos los campos requeridos.');
            notify("Por favor completa todos los campos requeridos.", "warning", 2500);
            return;
        }
        const payload: ComuneroFormData = {
            ...formData,
            usuario_creador: usuario,
            familiares: isEditing ? undefined : familiares,
        };
        onSubmit({
            ...payload,
        } as ComuneroFormData & { nombres_completos?: string } as any);
        setFormData(toInitial(comunero));
        setFamiliares([]);
        setUploaderKey(prev => prev + 1);
    };
    //console.log("recibo lsita", listaComunidades)
    const formItems: any[] = useMemo(() => ([
        //const formItems: any[] = [
        {
            itemType: 'group',
            caption: 'Datos del Comunero',
            colCount: 4,
            items: [
                {
                    dataField: 'id_comunidad', label: { text: 'Comunidad' },
                    validationRules: [required('Requerido')],
                    editorType: 'dxSelectBox',
                    editorOptions: {
                        dataSource: listaComunidades,
                        //dataSource: [{ id: 1, nombre: "LUCMA" }],
                        displayExpr: 'nombre',
                        valueExpr: 'id',
                    },
                },
                { dataField: 'nombres', label: { text: 'Nombres' }, validationRules: [required('Requerido')] },
                { dataField: 'ape_pat', label: { text: 'Apellido Paterno' }, validationRules: [required('Requerido')] },
                { dataField: 'ape_mat', label: { text: 'Apellido Materno' } },
                { dataField: 'dni', label: { text: 'DNI' }, validationRules: [required('Requerido')] },
                {
                    dataField: 'fecha_nacimiento',
                    editorOptions: {
                        type: 'date',
                        displayFormat: 'dd/MM/yyyy',
                        dateSerializationFormat: 'yyyy-MM-dd'
                    },
                    editorType: 'dxDateBox', label: { text: 'Fecha Nacimiento' }, validationRules: [required('Requerido')]
                },
                {
                    dataField: 'fecha_admision',
                    label: { text: 'Año Admisión' },
                    editorType: 'dxNumberBox',
                    editorOptions: {
                        min: 1900,
                        max: 2100,
                        format: '####',
                        placeholder: 'ej. 2025'
                    },
                    validationRules: [
                        required('Requerido'),
                        { type: 'range', min: 1900, max: 2100, message: 'Ingrese un año válido' },
                        { type: 'pattern', pattern: /^\d{4}$/, message: 'Debe ser un año de 4 dígitos' }
                    ]
                },
                { dataField: 'ganado_mayor', label: { text: 'Ganado Mayor' } },
                { dataField: 'ganado_menor', label: { text: 'Ganado Menor' } },

                {
                    dataField: 'sexo',
                    label: { text: 'Sexo' },
                    editorType: 'dxSelectBox',
                    editorOptions: {
                        dataSource: [
                            { v: 'Masculino', t: 'Masculino' },
                            { v: 'Femenino', t: 'Femenino' }
                        ],
                        valueExpr: 'v',
                        displayExpr: 't'
                    }
                },
                { dataField: 'domicilio', colSpan: 2, label: { text: 'Domicilio' } },
                {
                    dataField: 'caserio_id',
                    label: { text: 'Caserío' },
                    editorType: 'dxSelectBox',
                    editorOptions: {
                        dataSource: listaCaserios,
                        displayExpr: 'nombre',
                        valueExpr: 'id',
                        searchEnabled: true,
                        placeholder: 'Seleccione caserío...',
                    },
                },
                {
                    dataField: 'estado_civil',
                    label: { text: 'Estado Civil' },
                    editorType: 'dxSelectBox',
                    editorOptions: {
                        dataSource: listaEstadoCivil,
                        displayExpr: 'valor',
                        valueExpr: 'id',
                        placeholder: 'Seleccione estado civil...',
                    },
                },
            ]
        }
    ]), [listaComunidades, listaCaserios, listaEstadoCivil]);
    //];

    return (
        <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-full">
            <h3 className="text-xl font-semibold mb-6 text-gray-800">
                {isEditing ? 'Editar Comunero' : 'Nuevo Comunero'}
            </h3>

            <Form
                formData={formData}
                onFieldDataChanged={(e: any) => {
                    setFormData({ ...formData, [e.dataField]: e.value });
                }}
                labelLocation="top"
                //colCount={2}
                items={formItems}
                validationGroup="comuneroForm"
                ref={formRef}
            />
            <FamiliaresSection
                familiares={familiares}
                parentescos={parentescos}
                loading={loadingFamiliares}
                onSave={handleSaveFamiliar}
                onDelete={handleDeleteFamiliar}
            />
            {/* {!isEditing && (
                <div className="mt-4">
                    <label className="block text-sm font-medium mb-2">
                        Foto del Comunero
                    </label>

                    <FileUploader
                        key={uploaderKey}
                        accept="image/*"
                        uploadMode="useForm"
                        multiple={false}
                        selectButtonText="Seleccionar imagen"
                        //labelText="o arrastre aquí"
                        labelText=""
                        onValueChanged={(e) => {
                            setFormData(prev => ({
                                ...prev,
                                file: e.value ?? []
                            }));
                        }}
                    />
                </div>
            )} */}


            <div className="flex justify-end space-x-4 mt-6">
                <Button text="Cancelar" type="normal" stylingMode="outlined" onClick={onCancel} className="px-6" />
                <Button text={isEditing ? 'Actualizar' : 'Guardar'} type="default" stylingMode="contained" onClick={handleSubmit} className="px-6" />
            </div>
        </div>
    );
};

export default React.memo(ComuneroForm);