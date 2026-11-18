import React, { useEffect, useState } from "react";
import RadioGroup from "devextreme-react/radio-group";
import FileUploader from "devextreme-react/file-uploader";
import { TipoFirma } from "../../types/FirmaDocumento";

const OPCIONES = [
    { value: "texto" as TipoFirma, text: "Firma con mi nombre (autogenerada)" },
    { value: "imagen" as TipoFirma, text: "Arrastrar imagen de firma" },
];

type Props = {
    tipoFirma: TipoFirma;
    onChangeTipo: (t: TipoFirma) => void;
    imagenFirma: File | null;
    onChangeImagen: (f: File | null) => void;
};

/** Permite elegir cómo se va a firmar: con el nombre del firmante
 * (autogenerado, sin necesitar un archivo) o subiendo/arrastrando una
 * imagen de la firma (PNG/JPG, idealmente con fondo transparente). */
const SelectorTipoFirma: React.FC<Props> = ({ tipoFirma, onChangeTipo, imagenFirma, onChangeImagen }) => {
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    useEffect(() => {
        if (!imagenFirma) {
            setPreviewUrl(null);
            return;
        }
        const url = URL.createObjectURL(imagenFirma);
        setPreviewUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [imagenFirma]);

    return (
        <div className="flex flex-col gap-3">
            <label className="text-sm font-medium text-gray-700">Forma de firmar</label>
            <RadioGroup
                items={OPCIONES}
                valueExpr="value"
                displayExpr="text"
                value={tipoFirma}
                layout="vertical"
                onValueChanged={(e: any) => onChangeTipo(e.value)}
            />
            {tipoFirma === "imagen" && (
                <div className="flex items-center gap-3">
                    <FileUploader
                        selectButtonText={imagenFirma ? "Cambiar imagen" : "Seleccionar imagen"}
                        labelText="o arrastra tu firma aquí"
                        multiple={false}
                        accept="image/png,image/jpeg"
                        uploadMode="useForm"
                        onValueChanged={(e: any) => onChangeImagen((e.value && e.value[0]) || null)}
                    />
                    {previewUrl && (
                        <div className="flex h-16 w-32 items-center justify-center rounded border border-gray-200 bg-white p-1">
                            <img src={previewUrl} alt="Vista previa firma" className="max-h-full max-w-full object-contain" />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default SelectorTipoFirma;
