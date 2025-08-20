import React, { useMemo, useState } from 'react';
import { Form } from 'devextreme-react/form';
import { Button } from 'devextreme-react/button';
import TextArea from 'devextreme-react/text-area';
import { Personal, PersonalFormData } from '../../types/Personal';

interface PersonalFormProps {
    personal?: Personal;
    onSubmit: (data: PersonalFormData) => void;
    onCancel: () => void;
    isEditing: boolean;
}

const toInitial = (p?: Personal): PersonalFormData => ({
    nombres: p?.nombres || '',
    ape_pat: p?.ape_pat || '',
    ape_mat: p?.ape_mat || '',
    documento: p?.documento || '',
    tipo_doc: p?.tipo_doc ?? 2,
    puesto: p?.puesto ?? 123,
    area: p?.area ?? 12,
    sub_area: p?.sub_area ?? 0,
    // usu_reg se setea al enviar
    tipo: p?.tipo || 'Empleado',
    fecha_ingreso: p?.fecha_ingreso || '',
    guardia: p?.guardia || 'Día',
    sexo: (p?.sexo as any) || 'Masculino',
    estado_civil: p?.estado_civil || 'Soltero',
    celular: p?.celular || '',
    correo: p?.correo || '',
    fecha_nac: p?.fecha_nac || '',
    sueldo: p?.sueldo ?? 0,
    comunero: p?.comunero || 'No',
    direccion: p?.direccion || '',
    distrito: p?.distrito || '',
    provincia: p?.provincia || '',
    departamento: p?.departamento || '',
    es_padre: p?.es_padre || 'No',
    nombre_conyuge: p?.nombre_conyuge ?? null,
    dni_conyuge: p?.dni_conyuge ?? null,
    regimen_pensionario: p?.regimen_pensionario || 'ONP',
    n_cup: p?.n_cup || '',
    cuenta_bancaria: p?.cuenta_bancaria || '',
    cci: p?.cci || '',
    banco: p?.banco || '',
    tipo_contrato: p?.tipo_contrato || 'Indeterminado',
    sistema: p?.sistema || 'Planilla',
    numero_emergencia: p?.numero_emergencia || '',
    contacto_emergencia: p?.contacto_emergencia || '',
    estado: (p?.estado as any) || '1',
});

const PersonalForm: React.FC<PersonalFormProps> = ({
    personal,
    onSubmit,
    onCancel,
    isEditing
}) => {
    const [formData, setFormData] = useState<PersonalFormData>(toInitial(personal));

    const required = (msg: string) => ({ type: 'required' as const, message: msg });

    const handleSubmit = (e: any) => {
        //e.preventDefault(); 
        const nombres_completos = `${formData.nombres} ${formData.ape_pat} ${formData.ape_mat || ''}`.trim();
        const payload: PersonalFormData = {
            ...formData,
            usu_reg: 'admin'
        };
        onSubmit({
            ...payload,
            // el endpoint requiere nombres_completos en el JSON final;
            // esto lo usará el hook al hacer la llamada
            // (ver sección 4 para cómo se envía)
            // lo mantenemos en payload final vía mapper en el hook
        } as PersonalFormData & { nombres_completos?: string } as any);
    };

    const formItems: any[] = useMemo(() => ([
        {
            itemType: 'group',
            caption: 'Identificación',
            colCount: 2,
            items: [
                { dataField: 'nombres', label: { text: 'Nombres' }, validationRules: [required('Requerido')] },
                { dataField: 'ape_pat', label: { text: 'Apellido Paterno' }, validationRules: [required('Requerido')] },
                { dataField: 'ape_mat', label: { text: 'Apellido Materno' } },
                { dataField: 'documento', label: { text: 'Documento' }, validationRules: [required('Requerido')] },
                {
                    dataField: 'tipo_doc',
                    label: { text: 'Tipo Doc.' },
                    editorType: 'dxSelectBox',
                    editorOptions: {
                        dataSource: [
                            { id: 2, text: 'DNI' },
                            { id: 1, text: 'CE' },
                            { id: 3, text: 'Pasaporte' }
                        ],
                        valueExpr: 'id',
                        displayExpr: 'text'
                    }
                },
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
                {
                    dataField: 'estado_civil',
                    label: { text: 'Estado Civil' },
                    editorType: 'dxSelectBox',
                    editorOptions: {
                        dataSource: ['Soltero', 'Casado', 'Divorciado', 'Viudo'],
                    }
                },
            ]
        },
        {
            itemType: 'group',
            caption: 'Laboral',
            colCount: 2,
            items: [
                { dataField: 'tipo', label: { text: 'Tipo' }, editorType: 'dxSelectBox', editorOptions: { dataSource: ['Empleado', 'Practicante', 'Consultor'] } },
                { dataField: 'puesto', label: { text: 'Puesto (ID numérico)' }, editorType: 'dxNumberBox' },
                { dataField: 'area', label: { text: 'Área (ID numérico)' }, editorType: 'dxNumberBox' },
                { dataField: 'sub_area', label: { text: 'Sub Área (ID numérico)' }, editorType: 'dxNumberBox' },
                { dataField: 'fecha_ingreso', label: { text: 'Fecha Ingreso (DD/MM/YYYY)' }, editorType: 'dxTextBox' },
                { dataField: 'guardia', label: { text: 'Guardia' }, editorType: 'dxSelectBox', editorOptions: { dataSource: ['Día', 'Noche', 'Mixto'] } },
                { dataField: 'sueldo', label: { text: 'Sueldo' }, editorType: 'dxNumberBox' },
                { dataField: 'tipo_contrato', label: { text: 'Tipo de Contrato' }, editorType: 'dxSelectBox', editorOptions: { dataSource: ['Indeterminado', 'Plazo Fijo', 'Locación'] } },
                { dataField: 'sistema', label: { text: 'Sistema' }, editorType: 'dxSelectBox', editorOptions: { dataSource: ['Planilla', 'Honorarios'] } },
                { dataField: 'regimen_pensionario', label: { text: 'Régimen Pensionario' }, editorType: 'dxSelectBox', editorOptions: { dataSource: ['ONP', 'AFP'] } },
                { dataField: 'n_cup', label: { text: 'N° CUP' } },
            ]
        },
        {
            itemType: 'group',
            caption: 'Contacto y Dirección',
            colCount: 2,
            items: [
                { dataField: 'celular', label: { text: 'Celular' } },
                { dataField: 'correo', label: { text: 'Correo' } },
                { dataField: 'direccion', label: { text: 'Dirección' }, editorComponent: TextArea, editorOptions: { height: 50 } },
                { dataField: 'distrito', label: { text: 'Distrito' } },
                { dataField: 'provincia', label: { text: 'Provincia' } },
                { dataField: 'departamento', label: { text: 'Departamento' } },
                { dataField: 'numero_emergencia', label: { text: 'N° Emergencia' } },
                { dataField: 'contacto_emergencia', label: { text: 'Contacto Emergencia' } },
            ]
        },
        {
            itemType: 'group',
            caption: 'Datos Familiares',
            colCount: 2,
            items: [
                { dataField: 'es_padre', label: { text: '¿Es Padre/Madre?' }, editorType: 'dxSelectBox', editorOptions: { dataSource: ['Sí', 'No'] } },
                { dataField: 'comunero', label: { text: 'Comunero' }, editorType: 'dxSelectBox', editorOptions: { dataSource: ['Sí', 'No'] } },
                { dataField: 'nombre_conyuge', label: { text: 'Nombre Cónyuge' } },
                { dataField: 'dni_conyuge', label: { text: 'DNI Cónyuge' } },
            ]
        },
        {
            itemType: 'group',
            caption: 'Bancario',
            colCount: 2,
            items: [
                { dataField: 'banco', label: { text: 'Banco' } },
                { dataField: 'cuenta_bancaria', label: { text: 'Cuenta Bancaria' } },
                { dataField: 'cci', label: { text: 'CCI' } },
            ]
        },
        {
            itemType: 'group',
            caption: 'Otras Fechas/Estado',
            colCount: 2,
            items: [
                { dataField: 'fecha_nac', label: { text: 'Fecha Nac. (DD/MM/YYYY)' }, editorType: 'dxTextBox' },
                {
                    dataField: 'estado',
                    label: { text: 'Estado' },
                    editorType: 'dxSelectBox',
                    editorOptions: { dataSource: [{ v: '1', t: 'Activo' }, { v: '0', t: 'Inactivo' }], valueExpr: 'v', displayExpr: 't' }
                },
            ]
        },
    ]), []);

    return (
        <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-5xl">
            <h3 className="text-xl font-semibold mb-6 text-gray-800">
                {isEditing ? 'Editar Personal' : 'Nuevo Personal'}
            </h3>

            <Form
                formData={formData}
                onFieldDataChanged={(e: any) => {
                    setFormData({ ...formData, [e.dataField]: e.value });
                }}
                labelLocation="top"
                colCount={2}
                items={formItems}
            />

            <div className="flex justify-end space-x-4 mt-6">
                <Button text="Cancelar" type="normal" stylingMode="outlined" onClick={onCancel} className="px-6" />
                <Button text={isEditing ? 'Actualizar' : 'Guardar'} type="default" stylingMode="contained" onClick={handleSubmit} className="px-6" />
            </div>
        </div>
    );
};

export default React.memo(PersonalForm);