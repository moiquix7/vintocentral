/** "Mi perfil": photo, name, username, password and appearance. Available to every signed-in user. */
import { h, icon, mount, pageHeader } from '../../core/dom.js';
import { session } from '../../core/session.js';
import { notify, handleError } from '../../core/notify.js';
import { LIMITS, ROLES } from '../../config/app-config.js';
import { field, input, runSubmit } from '../../shared/form.js';
import { avatar } from '../../shared/avatar.js';
import { compressImage } from '../../shared/image.js';
import { isCameraSupported, takePhoto } from '../../shared/camera.js';
import { appearanceControls } from '../../shared/appearance.js';
import { updateProfile, changePassword } from './profile.service.js';

const L = LIMITS.user;

function photoEditor(profile) {
  const state = { blob: null, previewUrl: '', remove: false };
  const preview = h('div', { class: 'avatar-preview' });
  const fileInput = h('input', { type: 'file', accept: 'image/*', class: 'visually-hidden', tabindex: '-1', 'aria-hidden': 'true' });
  const captureInput = h('input', { type: 'file', accept: 'image/*', capture: 'user', class: 'visually-hidden', tabindex: '-1', 'aria-hidden': 'true' });
  const removeButton = h('button', { type: 'button', class: 'btn btn-secondary btn-small' }, icon('trash'), 'Quitar foto');

  function draw() {
    const src = state.previewUrl || (state.remove ? '' : profile.photoUrl);
    mount(preview, avatar(profile, { size: 112, src }));
    removeButton.hidden = !src;
  }

  function setPreview(blob) {
    if (state.previewUrl) URL.revokeObjectURL(state.previewUrl);
    state.blob = blob;
    state.previewUrl = blob ? URL.createObjectURL(blob) : '';
    draw();
  }

  async function useFile(file) {
    if (!file) return;
    try {
      state.remove = false;
      setPreview(await compressImage(file, LIMITS.profileImage));
    } catch (error) {
      handleError(error, 'profile photo');
    }
  }

  const onFiles = (event) => {
    useFile(event.target.files[0]);
    event.target.value = '';
  };
  fileInput.addEventListener('change', onFiles);
  captureInput.addEventListener('change', onFiles);
  removeButton.addEventListener('click', () => {
    state.remove = true;
    setPreview(null);
  });

  const choose = h('button', { type: 'button', class: 'btn btn-secondary btn-small', onclick: () => fileInput.click() }, icon('image'), 'Elegir foto');
  const camera = h('button', { type: 'button', class: 'btn btn-secondary btn-small' }, icon('camera'), 'Tomar foto');
  camera.addEventListener('click', async () => {
    if (!isCameraSupported()) {
      captureInput.click();
      return;
    }
    try {
      await useFile(await takePhoto());
    } catch (error) {
      handleError(error, 'camera');
    }
  });

  draw();
  return {
    node: h('div', { class: 'photo-editor' }, preview, h('div', { class: 'button-row' }, choose, camera, removeButton, fileInput, captureInput)),
    changes: () => ({ newPhoto: state.blob, removePhoto: state.remove && !state.blob }),
    dispose: () => state.previewUrl && URL.revokeObjectURL(state.previewUrl),
  };
}

function profileForm(profile, photo) {
  const displayName = input({ maxlength: L.displayName, value: profile.displayName, autocomplete: 'name' });
  const username = input({ maxlength: L.usernameMax, value: profile.username, autocomplete: 'username', autocapitalize: 'none', spellcheck: 'false' });
  const submit = h('button', { type: 'submit', class: 'btn btn-primary' }, 'Guardar perfil');
  const form = h(
    'form',
    { class: 'card form-grid', novalidate: true, 'aria-label': 'Datos del perfil' },
    h('h2', { class: 'field--wide' }, 'Datos personales'),
    h('div', { class: 'field--wide' }, photo.node),
    field({ label: 'Nombre completo', name: 'displayName', control: displayName, required: true }),
    field({
      label: 'Nombre de usuario',
      name: 'username',
      control: username,
      required: true,
      hint: profile.username ? 'Con este nombre ingresa al sistema.' : 'Aún no tiene uno. Elija uno para ingresar sin escribir su correo.',
    }),
    h('p', { class: 'field--wide muted' }, `Correo: ${profile.email} · Rol: ${ROLES[profile.role]}`),
    h('div', { class: 'field--wide button-row form-actions' }, submit),
  );
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const ok = await runSubmit(form, submit, () =>
      updateProfile({ displayName: displayName.value, username: username.value }, photo.changes()),
    );
    if (ok) notify.success('Perfil actualizado.');
  });
  return form;
}

function passwordForm() {
  const currentPassword = input({ type: 'password', autocomplete: 'current-password', maxlength: L.maxPassword });
  const newPassword = input({ type: 'password', autocomplete: 'new-password', maxlength: L.maxPassword });
  const confirmPassword = input({ type: 'password', autocomplete: 'new-password', maxlength: L.maxPassword });
  const submit = h('button', { type: 'submit', class: 'btn btn-primary' }, icon('key'), 'Cambiar contraseña');
  const form = h(
    'form',
    { class: 'card form-grid', novalidate: true, 'aria-label': 'Cambiar contraseña' },
    h('h2', { class: 'field--wide' }, 'Cambiar contraseña'),
    field({ label: 'Contraseña actual', name: 'currentPassword', control: currentPassword, required: true, wide: true }),
    field({ label: 'Nueva contraseña', name: 'newPassword', control: newPassword, required: true, hint: `Mínimo ${L.minPassword} caracteres.` }),
    field({ label: 'Repita la nueva contraseña', name: 'confirmPassword', control: confirmPassword, required: true }),
    h('div', { class: 'field--wide button-row form-actions' }, submit),
  );
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const ok = await runSubmit(form, submit, () =>
      changePassword({ currentPassword: currentPassword.value, newPassword: newPassword.value, confirmPassword: confirmPassword.value }),
    );
    if (ok) {
      notify.success('Contraseña cambiada.');
      form.reset();
    }
  });
  return form;
}

export async function render(container) {
  const profile = session.profile;
  const photo = photoEditor(profile);
  const appearance = appearanceControls();
  mount(
    container,
    pageHeader('Mi perfil'),
    profileForm(profile, photo),
    passwordForm(),
    h('section', { class: 'card' }, h('h2', null, 'Apariencia'), appearance.node),
  );
  return () => {
    photo.dispose();
    appearance.dispose();
  };
}
