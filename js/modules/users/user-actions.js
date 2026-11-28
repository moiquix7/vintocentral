/**
 * User administration actions shared by the user list and the user detail (admin only):
 * create dialog (two steps), edit dialog (role and department), deactivate / reactivate, password reset,
 * and the status badge. A component module: no route.
 */
import { h, icon } from '../../core/dom.js';
import { session } from '../../core/session.js';
import { notify, handleError } from '../../core/notify.js';
import { LIMITS, ROLES } from '../../config/app-config.js';
import { field, input, select, runSubmit } from '../../shared/form.js';
import { openModal, confirmDialog } from '../../shared/dialog.js';
import { createStepper } from '../../shared/stepper.js';
import { createUser, updateUserAccess, setUserActive, sendPasswordReset } from './user.service.js';
import { sanitizeNewUser, validateNewUser } from './user.model.js';
import { isActiveUser } from './user-filter.js';
import { categoryStore, catalogOptions } from '../catalogs/catalog.store.js';

const L = LIMITS.user;
export const NO_DEPARTMENT = 'Sin departamento';
export const ROLE_HINT = 'Consulta: solo ve artículos y reportes. Editor: tablero, registra y modifica. Administrador: todo.';

/** Department dropdown ("Departamentos" are stored in `categories`). */
function departmentSelect(value) {
  return select(catalogOptions(categoryStore), { value: value ?? '', placeholder: NO_DEPARTMENT });
}

export function statusBadge(user) {
  const active = isActiveUser(user);
  return h('span', { class: `badge badge--${active ? 'active' : 'inactive'}` }, active ? 'Activo' : 'Inactivo');
}

/** The signed-in admin: their own role and active flag cannot be changed (UI + rules). */
export const isSelf = (user) => user.uid === session.user?.uid;

/**
 * Single-screen dialog form ("Editar usuario": only two fields, no steps needed).
 * @param {{ title: string, label: string, saveText: string, nodes: Node[], action: () => Promise<unknown>, success: string }} spec
 * @returns {Promise<boolean>} true when saved
 */
function formDialog({ title, label, saveText, nodes, action, success }) {
  return openModal((close) => {
    const save = h('button', { type: 'submit', class: 'btn btn-primary' }, saveText);
    const form = h('form', { class: 'stack', novalidate: true, 'aria-label': label, id: `user-form-${Date.now()}` }, nodes);
    save.setAttribute('form', form.id);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (await runSubmit(form, save, action)) {
        notify.success(success);
        close(true);
      }
    });
    return {
      title,
      body: form,
      actions: [h('button', { type: 'button', class: 'btn btn-secondary', onclick: () => close(false) }, 'Cancelar'), save],
    };
  }).then((result) => result === true);
}

/** "Nuevo usuario": the account is created with a temporary password the admin hands over. */
export function openCreateUserDialog() {
  const controls = {
    displayName: input({ maxlength: L.displayName, autocomplete: 'off' }),
    username: input({ maxlength: L.usernameMax, autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false' }),
    email: input({ type: 'email', maxlength: L.email, autocomplete: 'off' }),
    role: select(ROLES, { value: 'viewer' }),
    departmentId: departmentSelect(''),
    password: input({ type: 'text', minlength: L.minPassword, maxlength: L.maxPassword, autocomplete: 'new-password' }),
  };
  const values = () => Object.fromEntries(Object.entries(controls).map(([key, control]) => [key, control.value]));
  // Two short steps (shared/stepper.js): who the person is, then what they may do.
  const steps = [
    {
      title: 'Datos de la persona',
      instructions: 'Escriba el nombre, el nombre de usuario con el que ingresará y su correo.',
      fields: ['displayName', 'username', 'email'],
      nodes: [
        field({ label: 'Nombre', name: 'displayName', control: controls.displayName, required: true }),
        field({ label: 'Nombre de usuario', name: 'username', control: controls.username, required: true, hint: 'Con este nombre ingresará. Ej.: maria.lopez' }),
        field({ label: 'Correo electrónico', name: 'email', control: controls.email, required: true, hint: 'Para recuperar la contraseña.' }),
      ],
    },
    {
      title: 'Acceso',
      instructions: 'Elija qué podrá hacer y escriba una contraseña temporal para entregarle.',
      fields: ['role', 'departmentId', 'password'],
      nodes: [
        field({ label: 'Rol', name: 'role', control: controls.role, required: true, hint: ROLE_HINT }),
        field({ label: 'Departamento', name: 'departmentId', control: controls.departmentId, hint: 'Opcional. Se propone al registrar un artículo (puede cambiarse).' }),
        field({ label: 'Contraseña temporal', name: 'password', control: controls.password, required: true, hint: `Mínimo ${L.minPassword} caracteres. Entréguela a la persona y pídale cambiarla.` }),
      ],
    },
  ];
  return openModal((close) => {
    const stepper = createStepper({
      label: 'Nuevo usuario',
      steps,
      submitLabel: 'Crear usuario',
      compact: true,
      cancel: h('button', { type: 'button', class: 'btn btn-secondary', onclick: () => close(false) }, 'Cancelar'),
      validateStep: () => validateNewUser(sanitizeNewUser(values())),
      onSubmit: async () => {
        const ok = await runSubmit(stepper.form, stepper.submitButton, () => createUser(values()), 'Creando…', { onInvalid: stepper.revealErrors });
        if (ok) {
          notify.success('Usuario creado.');
          close(true);
        }
      },
    });
    return { title: 'Nuevo usuario', body: stepper.form, actions: [] };
  }).then((result) => result === true);
}

/** "Editar": role and department. The admin may change their own department, never their own role. */
export function openEditUserDialog(user) {
  const self = isSelf(user);
  const role = select(ROLES, { value: user.role, disabled: self });
  const department = departmentSelect(user.departmentId);
  return formDialog({
    title: `Editar: ${user.displayName}`,
    label: 'Editar usuario',
    saveText: 'Guardar',
    success: 'Usuario actualizado.',
    action: () => updateUserAccess(user.uid, { role: role.value, active: isActiveUser(user), departmentId: department.value }),
    nodes: [
      h('p', { class: 'muted' }, user.username ? `@${user.username} · ${user.email}` : user.email),
      field({ label: 'Rol', name: 'role', control: role, required: true, hint: self ? 'No puede cambiar su propio rol.' : ROLE_HINT }),
      field({ label: 'Departamento', name: 'departmentId', control: department, hint: 'Se propone al registrar un artículo.' }),
    ],
  });
}

/**
 * Deactivate (with confirmation) or reactivate.
 * @returns {Promise<boolean>} true when the account changed
 */
export async function toggleUserActive(user) {
  const active = isActiveUser(user);
  const confirmed = await confirmDialog(
    active
      ? {
          title: 'Desactivar cuenta',
          message: `${user.displayName} ya no podrá ingresar al inventario. Puede reactivarla cuando quiera. ¿Continuar?`,
          confirmText: 'Desactivar',
          danger: true,
        }
      : {
          title: 'Reactivar cuenta',
          message: `${user.displayName} podrá volver a ingresar con su rol de ${ROLES[user.role] ?? 'usuario'}. ¿Continuar?`,
          confirmText: 'Reactivar',
        },
  );
  if (!confirmed) return false;
  try {
    await setUserActive(user, !active);
    notify.success(active ? 'Cuenta desactivada.' : 'Cuenta reactivada.');
    return true;
  } catch (error) {
    handleError(error, 'toggle user');
    return false;
  }
}

/** Sends the Firebase password-reset email to the user. */
export async function resetUserPassword(user, button) {
  button.disabled = true;
  try {
    await sendPasswordReset(user.email);
    notify.success(`Se envió un correo a ${user.email} para cambiar la contraseña.`);
  } catch (error) {
    handleError(error, 'reset password');
  } finally {
    button.disabled = false;
  }
}

/**
 * Editar · Desactivar/Reactivar · Restablecer contraseña. Self: no Desactivar.
 * @param {() => void} onChange called after a successful change (reload)
 */
export function userActionButtons(user, onChange) {
  const edit = h('button', { type: 'button', class: 'btn btn-secondary btn-small' }, icon('edit'), 'Editar');
  edit.addEventListener('click', async () => {
    if (await openEditUserDialog(user)) onChange();
  });

  let toggle = null;
  if (!isSelf(user)) {
    const active = isActiveUser(user);
    toggle = h('button', { type: 'button', class: `btn btn-small ${active ? 'btn-danger' : 'btn-secondary'}` }, icon(active ? 'lock' : 'check'), active ? 'Desactivar' : 'Reactivar');
    toggle.addEventListener('click', async () => {
      if (await toggleUserActive(user)) onChange();
    });
  }

  const reset = h('button', { type: 'button', class: 'btn btn-secondary btn-small' }, icon('key'), 'Restablecer contraseña');
  reset.addEventListener('click', () => resetUserPassword(user, reset));
  return h('div', { class: 'button-row' }, edit, toggle, reset);
}
