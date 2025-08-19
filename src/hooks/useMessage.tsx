import { useState, useEffect, useCallback } from 'react';
import { AuthService } from '../services/auth/AuthService';
import Swal, { SweetAlertIcon } from 'sweetalert2';

export const showMessage = (msg: string = '', type: SweetAlertIcon = 'success'): void => {
    const toast = Swal.mixin({
        toast: true,
        position: 'top',
        showConfirmButton: false,
        timer: 3000,
        customClass: { container: 'toast' },
    });

    toast.fire({
        icon: type,
        title: msg,
        padding: '10px 20px',
    });
};
