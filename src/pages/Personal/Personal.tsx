import React, { useState } from 'react';
import { Popup } from 'devextreme-react/popup';
//import { confirm } from 'devextreme/ui/dialog';
import { custom } from 'devextreme/ui/dialog';
import PersonalList from '../../components/Personal/PersonalList';
import PersonalForm from '../../components/Personal/PersonalForm';
import { usePersonal } from '../../hooks/usePersonal';
import { Personal, PersonalFormData } from '../../types/Personal';

const PersonalCRUD: React.FC = () => {
    const { personal, addPersonal, updatePersonal, deletePersonal, getPersonalById } = usePersonal();
    const [showForm, setShowForm] = useState(false);
    const [editingPersonal, setEditingPersonal] = useState<Personal | null>(null);

    const handleAdd = () => {
        setEditingPersonal(null);
        setShowForm(true);
    };

    const handleEdit = (personal: Personal) => {
        setEditingPersonal(personal);
        setShowForm(true);
    };

    const handleDelete = (id: number) => {
        const personalToDelete = getPersonalById(id);
        if (!personalToDelete) return;

        /* confirm(
             `¿Está seguro de eliminar a ${personalToDelete.nombre} ${personalToDelete.apellido}?`,
             'Confirmar eliminación'
         ).then((result) => {
             if (result) {
                 deletePersonal(id);
             }
         });*/
        const dialog = custom({
            title: 'Confirmar eliminación',
            messageHtml: `<div>¿Está seguro de eliminar a <strong>${personalToDelete.nombres} ${personalToDelete.ape_pat}</strong>?</div>`,
            buttons: [
                {
                    text: 'Eliminar',
                    onClick: () => {
                        deletePersonal(id);
                        return true;
                    },
                    stylingMode: 'contained',
                    type: 'danger'
                },
                {
                    text: 'Cancelar',
                    onClick: () => false,
                    stylingMode: 'outlined',
                    type: 'normal'
                }
            ]
        });

        dialog.show();
    };

    const handleSubmit = (data: PersonalFormData) => {
        if (editingPersonal?.id !== undefined && !isNaN(Number(editingPersonal.id))) {
            updatePersonal(Number(editingPersonal.id), data);
        } else {
            console.log("para agregar", data)
            addPersonal(data);
        }
        //setShowForm(false);
        setEditingPersonal(null);
    };

    const handleCancel = () => {
        setShowForm(false);
        setEditingPersonal(null);
    };

    const handleExport = () => {
        alert("liego veo export")
        /*if (dataGridRef) {
            const workbook = new Workbook();
            const worksheet = workbook.addWorksheet('Personal');

            exportDataGrid({
                component: dataGridRef,
                worksheet,
                autoFilterEnabled: true
            }).then(() => {
                workbook.xlsx.writeBuffer().then((buffer) => {
                    saveAs(new Blob([buffer], { type: 'application/octet-stream' }), 'Personal.xlsx');
                });
            });
        }*/
    };

    return (
        <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
            <div className="max-w-7xl mx-auto">
                <PersonalList
                    personal={personal}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    //onExport={handleExport}
                    onAdd={handleAdd}
                />

                <Popup
                    visible={showForm}
                    onHiding={() => setShowForm(false)}
                    showCloseButton
                    dragEnabled
                    resizeEnabled
                    // tamaño cómodo
                    width="90vw"
                    maxWidth={1200}
                    height="auto"
                    maxHeight="90vh"
                    wrapperAttr={{ class: 'personal-form-popup' }}
                >
                    <div className="max-h-[75vh] overflow-y-auto pr-2">
                        <PersonalForm
                            personal={editingPersonal || undefined}
                            onSubmit={handleSubmit}
                            onCancel={handleCancel}
                            isEditing={!!editingPersonal}
                        />
                    </div>
                </Popup>
            </div>
        </div>
    );
};

export default PersonalCRUD;