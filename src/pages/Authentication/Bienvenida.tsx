import React from 'react';
import IconHome from '../../components/Icon/IconHome';

interface WelcomeComponentProps {
    userName?: string;
    className?: string;
}

const Bienvenida: React.FC<WelcomeComponentProps> = ({
    userName = "Usuario",
    className = ""
}) => {
    return (
        <div className={`relative min-h-screen overflow-hidden ${className}`}>
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute top-20 left-20 w-72 h-72 bg-blue-400/5 rounded-full blur-xl animate-pulse"></div>
                <div className="absolute top-40 right-20 w-96 h-96 bg-purple-400/5 rounded-full blur-2xl animate-bounce" style={{ animationDuration: '6s' }}></div>
                <div className="absolute bottom-20 left-1/3 w-80 h-80 bg-amber-400/5 rounded-full blur-xl animate-pulse" style={{ animationDelay: '2s' }}></div>
            </div>

            <div className="relative z-10 flex items-center justify-center min-h-screen px-4 sm:px-6 lg:px-8 py-12">
                <div className="max-w-5xl mx-auto text-center">

                    <div className="mb-8 sm:mb-12">
                        <div className="inline-flex items-center justify-center relative">
                            <div className="absolute w-28 h-28 sm:w-36 sm:h-36 border-2 border-amber-400/30 rounded-full animate-spin" style={{ animationDuration: '20s' }}></div>
                            <div className="absolute w-32 h-32 sm:w-40 sm:h-40 border border-blue-400/20 rounded-full animate-spin" style={{ animationDuration: '15s', animationDirection: 'reverse' }}></div>

                            <div className="relative w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-br from-amber-400 via-yellow-500 to-amber-600 rounded-full flex items-center justify-center shadow-2xl">
                                <IconHome className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
                            </div>
                        </div>
                    </div>

                    <div className="mb-8 sm:mb-10">
                        <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold mb-4">
                            <span className="block text-gray-800 dark:text-white mb-2 drop-shadow-lg">Bienvenido al</span>
                            <span className="block bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-600 bg-clip-text text-transparent drop-shadow-2xl">
                                Intranet PDN 1.0
                            </span>
                        </h1>
                    </div>

                    <div className="mb-8 sm:mb-10">
                        <div className="inline-flex items-center px-6 py-3 bg-white/10 backdrop-blur-sm rounded-full border border-white/20">
                            <div className="w-2 h-2 bg-green-400 rounded-full mr-3 animate-pulse"></div>
                            <span className="text-lg sm:text-xl text-gray-700 dark:text-blue-100">
                                Hola
                                {/* <span className="font-bold text-amber-500">
                                 {nombre_usuario}//dsps podemos poner el nonbre del trabajodr
                                 </span> */}
                            </span>
                        </div>
                    </div>

                    <div className="max-w-3xl mx-auto mb-10 sm:mb-12">
                        <p className="text-lg sm:text-xl lg:text-2xl text-gray-700 dark:text-slate-300 leading-relaxed mb-4">
                            Bienvenido a nuestro <span className="text-amber-500 dark:text-amber-300 font-semibold">sistema de gestión empresarial</span>
                        </p>
                        <p className="text-base sm:text-lg text-gray-600 dark:text-slate-400 leading-relaxed">
                            Accede a todas las herramientas y recursos necesarios para optimizar
                            las operaciones mineras. Tu centro de control para la excelencia operacional.
                        </p>
                    </div>
                    {/* botones para nabegacion luego los colocamos */}
                    {/* <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-10 sm:mb-12 max-w-4xl mx-auto">
                        <div className="bg-black/10 backdrop-blur-sm border border-gray-300/20 rounded-xl p-4 sm:p-6 hover:bg-black/20 transition-all duration-300">
                            <div className="w-3 h-3 bg-green-400 rounded-full mx-auto mb-3 animate-pulse"></div>
                            <h3 className="text-gray-800 dark:text-white font-semibold text-sm sm:text-base mb-1">Sistema Activo</h3>
                            <p className="text-gray-600 dark:text-slate-400 text-xs sm:text-sm">Operacional 24/7</p>
                        </div>

                        <div className="bg-black/10 backdrop-blur-sm border border-gray-300/20 rounded-xl p-4 sm:p-6 hover:bg-black/20 transition-all duration-300">
                            <div className="w-3 h-3 bg-amber-400 rounded-full mx-auto mb-3"></div>
                            <h3 className="text-gray-800 dark:text-white font-semibold text-sm sm:text-base mb-1">polimetalicos.comp.e</h3>
                            <p className="text-gray-600 dark:text-slate-400 text-xs sm:text-sm">Plataforma Oficial</p>
                        </div>

                        <div className="bg-black/10 backdrop-blur-sm border border-gray-300/20 rounded-xl p-4 sm:p-6 hover:bg-black/20 transition-all duration-300">
                            <div className="w-3 h-3 bg-blue-400 rounded-full mx-auto mb-3"></div>
                            <h3 className="text-gray-800 dark:text-white font-semibold text-sm sm:text-base mb-1">Versión 1.0</h3>
                            <p className="text-gray-600 dark:text-slate-400 text-xs sm:text-sm">Última actualización</p>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6">
                        <button className="group inline-flex items-center px-8 py-4 bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-300">
                            <span>Ir al Dashboard</span>
                            <svg className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                            </svg>
                        </button>

                        <button className="inline-flex items-center px-6 py-3 text-gray-600 dark:text-slate-300 hover:text-gray-800 dark:hover:text-white border border-gray-400 dark:border-slate-600 hover:border-gray-500 dark:hover:border-slate-500 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-all duration-300">
                            <svg className="mr-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>Guía de usuario</span>
                        </button>
                    </div> */}
                </div>
            </div>

            {/* Partículas flotantes */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {Array.from({ length: 20 }).map((_, i) => {
                    const duration = 5 + Math.random() * 10;
                    const delay = Math.random() * 5;
                    return (
                        <div
                            key={i}
                            className="absolute w-1 h-1 bg-gray-400 dark:bg-white rounded-full opacity-30 animate-bounce"
                            style={{
                                left: `${Math.random() * 100}%`,
                                top: `${Math.random() * 100}%`,
                                animationDuration: `${duration}s`,
                                animationDelay: `${delay}s`,
                                transform: `translateY(${Math.random() * 50 - 25}px)`,
                            }}
                        />
                    );
                })}
            </div>
        </div>
    );
};

export default Bienvenida;