import React, { useEffect, useMemo, useState } from 'react';
import { Popup } from 'devextreme-react/popup';
import { Form } from 'devextreme-react/form';
import { Button } from 'devextreme-react/button';
import notify from 'devextreme/ui/notify';
import { Familiar, Parentesco } from '../../types/Comunero';

interface FamiliaresSectionProps {
    familiares: Familiar[];
    parentescos: Parentesco[];
    loading?: boolean;
    /** Devuelve una promesa cuando la operación es remota (edición); puede ser síncrono al crear. */
    onSave: (familiar: Familiar, index: number | null) => void | Promise<void>;
    onDelete: (familiar: Familiar, index: number) => void | Promise<void>;
}

const emptyFamiliar = (): Familiar => ({
    nombres: '',
    ape_pat: '',
    ape_mat: '',
    parentesco_id: null,
    edad_declarada: null,
    sexo: 'M',
    discapacidad: false,
    detalle_discapacidad: '',
    ocupacion_actividad: '',
    observacion: '',
});

const parentescoLabel = (p?: Parentesco) => p?.nombre ?? p?.valor ?? p?.descripcion ?? '';

const FamiliaresSection: React.FC<FamiliaresSectionProps> = ({ familiares, parentescos, loading, onSave, onDelete }) => {
    const [popupVisible, setPopupVisible] = useState(false);
    const [editIndex, setEditIndex] = useState<number | null>(null);
    const [draft, setDraft] = useState<Familiar>(emptyFamiliar());
    const [saving, setSaving] = useState(false);

    const parentescoItems = useMemo(
        () => parentescos.map(p => ({ id: p.id, nombre: parentescoLabel(p) })),
        [parentescos]
    );

    useEffect(() => {
        if (!popupVisible) setSaving(false);
    }, [popupVisible]);

    const openNew = () => {
        setEditIndex(null);
        setDraft(emptyFamiliar());
        setPopupVisible(true);
    };

    const openEdit = (f: Familiar, index: number) => {
        setEditIndex(index);
        setDraft({ ...f });
        setPopupVisible(true);
    };

    const handleAccept = async () => {
        const faltantes =
            !draft.nombres.trim() || !draft.ape_pat.trim() || !draft.parentesco_id || draft.edad_declarada == null;
        if (faltantes) {
            notify('Complete nombres, apellido paterno, parentesco y edad.', 'warning', 2500);
            return;
        }
        if (draft.discapacidad === true && !draft.detalle_discapacidad?.trim()) {
            notify('Indique el detalle de la discapacidad.', 'warning', 2500);
            return;
        }
        setSaving(true);
        try {
            await onSave(draft, editIndex);
            setPopupVisible(false);
        } catch {
            notify('No se pudo guardar el familiar.', 'error', 3000);
        } finally {
            setSaving(false);
        }
    };

    const nombreParentesco = (f: Familiar) =>
        f.parentesco ?? parentescoItems.find(p => p.id === f.parentesco_id)?.nombre ?? '—';

    const formItems: any[] = [
        { dataField: 'nombres', label: { text: 'Nombres' }, isRequired: true },
        { dataField: 'ape_pat', label: { text: 'Apellido Paterno' }, isRequired: true },
        { dataField: 'ape_mat', label: { text: 'Apellido Materno' } },
        {
            dataField: 'parentesco_id',
            label: { text: 'Parentesco' },
            isRequired: true,
            editorType: 'dxSelectBox',
            editorOptions: {
                dataSource: parentescoItems,
                displayExpr: 'nombre',
                valueExpr: 'id',
                placeholder: 'Seleccione parentesco...',
            },
        },
        {
            dataField: 'edad_declarada',
            label: { text: 'Edad' },
            isRequired: true,
            editorType: 'dxNumberBox',
            editorOptions: { min: 0, max: 120, showSpinButtons: true },
        },
        {
            dataField: 'sexo',
            label: { text: 'Sexo' },
            editorType: 'dxSelectBox',
            editorOptions: {
                dataSource: [{ v: 'M', t: 'Masculino' }, { v: 'F', t: 'Femenino' }],
                valueExpr: 'v',
                displayExpr: 't',
            },
        },
        { dataField: 'ocupacion_actividad', label: { text: 'Ocupación / Actividad' } },
        {
            dataField: 'discapacidad',
            label: { text: 'Discapacidad' },
            editorType: 'dxSelectBox',
            editorOptions: {
                dataSource: [{ v: false, t: 'No' }, { v: true, t: 'Sí' }],
                valueExpr: 'v',
                displayExpr: 't',
            },
        },
        {
            dataField: 'detalle_discapacidad',
            label: { text: 'Detalle de discapacidad' },
            colSpan: 2,
            visible: draft.discapacidad === true,
        },
        { dataField: 'observacion', label: { text: 'Observación' }, colSpan: 2 },
    ];

    return (
        <div className="mt-6 border border-gray-200 rounded-lg overflow-hidden">
            <div className="flex items-center justify-between bg-blue-50 px-4 py-3">
                <div>
                    <div className="flex items-center gap-2 font-semibold text-gray-800">
                        <i className="dx-icon-group text-blue-600" /> Información Familiar
                    </div>
                    <p className="text-sm text-gray-500">
                        Registre los miembros de su núcleo familiar que conviven con el comunero.
                    </p>
                </div>
                <Button text="Agregar familiar" icon="plus" type="default" stylingMode="contained" onClick={openNew} />
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-gray-100 text-left text-gray-700">
                        <tr>
                            <th className="px-3 py-2 w-10">#</th>
                            <th className="px-3 py-2">Nombres y Apellidos</th>
                            <th className="px-3 py-2">Parentesco</th>
                            <th className="px-3 py-2">Edad</th>
                            <th className="px-3 py-2">Sexo</th>
                            <th className="px-3 py-2">Discapacidad</th>
                            <th className="px-3 py-2">Ocupación / Actividad</th>
                            <th className="px-3 py-2 text-center">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={8} className="px-3 py-4 text-center text-gray-400">Cargando familiares…</td></tr>
                        ) : familiares.length === 0 ? (
                            <tr><td colSpan={8} className="px-3 py-4 text-center text-gray-400">Sin familiares registrados</td></tr>
                        ) : familiares.map((f, i) => (
                            <tr key={f.id ?? `n-${i}`} className="border-t border-gray-100">
                                <td className="px-3 py-2">{i + 1}</td>
                                <td className="px-3 py-2">{[f.nombres, f.ape_pat, f.ape_mat].filter(Boolean).join(' ')}</td>
                                <td className="px-3 py-2">{nombreParentesco(f)}</td>
                                <td className="px-3 py-2">{f.edad_declarada}</td>
                                <td className="px-3 py-2">
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${f.sexo === 'M' ? 'bg-blue-100 text-blue-800' : 'bg-pink-100 text-pink-800'}`}>
                                        {f.sexo === 'M' ? 'Masculino' : 'Femenino'}
                                    </span>
                                </td>
                                <td className="px-3 py-2">
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${f.discapacidad ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                        {f.discapacidad ? 'Sí' : 'No'}
                                    </span>
                                </td>
                                <td className="px-3 py-2">{f.ocupacion_actividad}</td>
                                <td className="px-3 py-2">
                                    <div className="flex justify-center gap-1">
                                        <Button icon="edit" hint="Editar" stylingMode="text" type="default" onClick={() => openEdit(f, i)} />
                                        <Button icon="trash" hint="Eliminar" stylingMode="text" type="danger" onClick={() => onDelete(f, i)} />
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <Popup
                visible={popupVisible}
                onHiding={() => setPopupVisible(false)}
                showCloseButton
                dragEnabled
                width="90vw"
                maxWidth={800}
                height="auto"
                maxHeight="90vh"
                title={editIndex === null ? 'Agregar familiar' : 'Editar familiar'}
            >
                <div className="p-2">
                    <Form
                        formData={draft}
                        onFieldDataChanged={(e: any) => setDraft(prev => ({ ...prev, [e.dataField]: e.value }))}
                        labelLocation="top"
                        colCount={2}
                        items={formItems}
                    />
                    <div className="flex justify-end gap-3 mt-4">
                        <Button text="Cancelar" type="normal" stylingMode="outlined" onClick={() => setPopupVisible(false)} />
                        <Button text={saving ? 'Guardando…' : 'Aceptar'} type="default" stylingMode="contained" disabled={saving} onClick={handleAccept} />
                    </div>
                </div>
            </Popup>
        </div>
    );
};

export default FamiliaresSection;
