import Button from "devextreme-react/cjs/button";
import FileUploader from "devextreme-react/cjs/file-uploader";
import Switch from "devextreme-react/cjs/switch";
// --- Types
type DocKey = "EMO" | "CUL" | "Anexo5" | string;

type DocState = {
    file?: File | null;
    aprobado: boolean; // true = aprobado, false = desaprobado
};
const DocumentoSubir: React.FC<{
    k: DocKey;
    value: DocState;
    onChange: (next: DocState) => void;
    LISTA_DOCUMENTOS: Record<DocKey, string>;
}> = ({ k, value, onChange, LISTA_DOCUMENTOS }) => {
    const handleFileUpload = async () => {
        if (!value.file) {
            alert("Por favor selecciona un archivo antes de cargarlo.");
            return;
        }

        const formData = new FormData();
        formData.append("file", value.file);

        try {
            const response = await fetch("https://api.polimetalicos.com.pe/upload", {
                method: "POST",
                body: formData,
            });

            if (response.ok) {
                const data = await response.json();
                alert("Archivo cargado con éxito");
                // Si quieres, puedes actualizar el estado después de la carga
                // onChange({...value, file: data.newFileUrl}); // Si el servidor devuelve la URL del archivo
            } else {
                alert("Error al cargar el archivo. Intenta nuevamente.");
            }
        } catch (error) {
            console.error("Error en la carga del archivo:", error);
            alert("Hubo un problema con la carga del archivo.");
        }
    };

    return (
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-4 flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h4 className="font-semibold text-gray-800">{LISTA_DOCUMENTOS[k]}</h4>
                    <p className="text-sm text-gray-500">Sube el documento y define su estado.</p>
                </div>
                <span
                    className={
                        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium " +
                        (value.aprobado ? "bg-green-50 text-green-700" : "bg-rose-50 text-rose-700")
                    }
                >
                    {value.aprobado ? "Aprobado" : "Desaprobado"}
                </span>
            </div>

            <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                    <label className="text-sm text-gray-600 min-w-[96px]">Archivo</label>
                    <div className="flex-1">
                        <FileUploader
                            selectButtonText={value.file ? "Cambiar" : "Seleccionar"}
                            labelText=""
                            multiple={false}
                            accept=".pdf,.jpg,.jpeg,.png"
                            uploadMode="useForm"
                            onValueChanged={(e: any) => {
                                const file = (e.value && e.value[0]) || null;
                                onChange({ ...value, file });
                            }}
                        />
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <label className="text-sm text-gray-600 min-w-[96px]">Estado</label>
                    <div className="flex items-center gap-2">
                        <Switch
                            value={value.aprobado}
                            onValueChanged={(e: any) => onChange({ ...value, aprobado: !!e.value })}
                        />
                        <span className="text-sm text-gray-700">
                            {value.aprobado ? "Aprobado" : "Desaprobado"}
                        </span>
                    </div>
                </div>

                {value.file && (
                    <div className="text-xs text-gray-500">
                        Seleccionado: <span className="font-medium text-gray-700">{value.file.name}</span>
                    </div>
                )}

                {/* Botón para cargar el archivo */}
                <div className="mt-4">
                    <Button
                        stylingMode="contained"
                        text="Cargar Archivo"
                        onClick={handleFileUpload}
                        type="default"
                    />
                </div>
            </div>
        </div>
    );
};

export default DocumentoSubir;