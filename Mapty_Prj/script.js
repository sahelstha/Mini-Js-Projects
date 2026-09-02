'use strict';

import { Cycling, Running } from './workout.js';

const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');
const filters = document.querySelector('.functionality');

class App {
  #map;
  #mapZoomLevel = 15;
  #mapEvent;
  #workouts = [];
  #editingWorkoutId = null;
  #workoutMarkers = new Map();

  constructor() {
    this._getPosition();

    // Get data from local storage
    this._getLocalStorage();

    form.addEventListener('submit', this._newWorkout.bind(this));

    inputType.addEventListener('change', this._toggleElevationField);

    containerWorkouts.addEventListener('click', this._moveToPopup.bind(this));

    filters.addEventListener('click', this._filterBtnEvent.bind(this));
  }

  _getPosition() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        this._loadMap.bind(this),
        function () {
          alert('Could not get your position');
        },
      );
    }
  }

  _loadMap(position) {
    const { latitude } = position.coords;
    const { longitude } = position.coords;

    const coords = [latitude, longitude];

    this.#map = L.map('map').setView(coords, this.#mapZoomLevel);

    L.tileLayer(
      'https://tiles.stadiamaps.com/tiles/osm_bright/{z}/{x}/{y}.png',

      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      },
    ).addTo(this.#map);

    this.#map.on('click', this._showForm.bind(this));

    this.#workouts.forEach(workout => {
      this._renderWorkoutMarker(workout);
    });
  }

  _showForm(mapE) {
    if (mapE) this.#mapEvent = mapE;
    form.classList.remove('hidden');
    inputDistance.focus();
  }

  _hideForm() {
    inputDistance.value =
      inputDuration.value =
      inputCadence.value =
      inputElevation.value =
        '';
    form.style.display = 'none';
    form.classList.add('hidden');
    setTimeout(() => (form.style.display = 'grid'), 1000);
  }

  _toggleElevationField() {
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden');

    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
  }

  _newWorkout(e) {
    const validInputs = (...inputs) => {
      return inputs.every(inp => Number.isFinite(inp));
    };
    const allPositive = (...inputs) => {
      return inputs.every(inp => inp > 0);
    };
    e.preventDefault();

    // Get the data from form
    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;

    if (this.#editingWorkoutId) {
      const workout = this.#workouts.find(w => w.id === this.#editingWorkoutId);

      if (type === 'running') {
        const cadence = +inputCadence.value;
        if (
          !validInputs(distance, duration, cadence) ||
          !allPositive(distance, duration, cadence)
        )
          return alert('Inputs have to be positive numbers!');

        workout.distance = distance;
        workout.duration = duration;
        workout.cadence = cadence;

        console.log(workout);

        workout.calcPace();
      }

      if (type === 'cycling') {
        const elevation = +inputElevation.value;
        if (
          !validInputs(distance, duration, elevation) ||
          !allPositive(distance, duration)
        )
          return alert('Inputs have to be positive numbers!');

        workout.distance = distance;
        workout.duration = duration;
        workout.elevationGain = elevation;
        workout.calcSpeed();
      }

      const oldEl = document.querySelector(`.workout[data-id="${workout.id}"]`);
      if (oldEl) oldEl.remove();
      this._renderWorkout(workout);

      this.#editingWorkoutId = null;
      inputType.disabled = false;
      this._hideForm();
      this._setLocalStorage();

      return;
    }

    const { lat, lng } = this.#mapEvent.latlng;
    let workout;

    // If workout running, create running object
    if (type === 'running') {
      const cadence = +inputCadence.value;
      // Check if data is valid
      if (
        !validInputs(distance, duration, cadence) ||
        !allPositive(distance, duration, cadence)
      )
        return alert('Inputs have to be positive numbers!');

      workout = new Running([lat, lng], distance, duration, cadence);
    }

    // If workout cycling, create cycling object
    if (type === 'cycling') {
      // Check if data is valid
      const elevation = +inputElevation.value;
      if (
        !validInputs(distance, duration, elevation) ||
        !allPositive(distance, duration)
      )
        return alert('Inputs have to be positive numbers!');

      workout = new Cycling([lat, lng], distance, duration, elevation);
    }

    // Add new object to workout array
    this.#workouts.push(workout);

    // Render workout on map as marker
    this._renderWorkoutMarker(workout);

    // Render workout on list
    this._renderWorkout(workout);

    // Hide form + clear input fileds
    this._hideForm();

    // Set local storage to all workouts
    this._setLocalStorage();

    // Add event to delete all function
  }

  _renderWorkoutMarker(workout) {
    const market = L.marker(workout.coords)
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 100,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`,
        }),
      )
      .setPopupContent(
        `${workout.type === 'running' ? '🏃‍♂️' : '🚴🏻'} ${workout.description}`,
      )
      .openPopup();

    this.#workoutMarkers.set(workout.id, market);
  }

  _renderWorkout(workout) {
    if (this.#workouts.length !== 0) {
      filters.classList.remove('hidden');
    }

    let html = `
      <li class="workout workout--${workout.type}" data-id="${workout.id}">
        <div class="description-title">
          <h2 class="workout__title">${workout.description}</h2>
          <div class="workout-btns">
            <button class="edit-btn" >Edit</button>
            <button class="delete-btn">Delete</button>
          </div>
        </div>
        <div class="workout__details">
          <span class="workout__icon">${workout.type === 'running' ? '🏃‍♂️' : '🚴🏻'}</span>
          <span class="workout__value">${workout.distance}</span>
          <span class="workout__unit">km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⏱</span>
          <span class="workout__value">${workout.duration}</span>
          <span class="workout__unit">min</span>
        </div>
      `;

    if (workout.type === 'running')
      html += `
          <div class="workout__details">
            <span class="workout__icon">⚡️</span>
            <span class="workout__value">${workout.pace.toFixed(1)}</span>
            <span class="workout__unit">min/km</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">🦶🏼</span>
            <span class="workout__value">${workout.cadence}</span>
            <span class="workout__unit">spm</span>
          </div>
        </li>`;

    if (workout.type === 'cycling')
      html += `
          <div class="workout__details">
            <span class="workout__icon">⚡️</span>
            <span class="workout__value">${workout.speed.toFixed(1)}</span>
            <span class="workout__unit">km/h</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">⛰</span>
            <span class="workout__value">${workout.elevationGain}</span>
            <span class="workout__unit">m</span>
          </div>
        </li>`;

    filters.insertAdjacentHTML('afterend', html);
  }

  _moveToPopup(e) {
    const workoutEl = e.target.closest('.workout');

    if (!workoutEl) return;

    const workout = this.#workouts.find(
      work => work.id === workoutEl.dataset.id,
    );

    if (e.target.closest('.edit-btn')) {
      this._showForm();
      inputType.value = workout.type;
      inputDistance.value = workout.distance;
      inputDuration.value = workout.duration;

      if (workout.type === 'running') inputCadence.value = workout.cadence;
      else inputElevation.value = workout.elevationGain;
      this.#editingWorkoutId = workout.id;
      inputType.disabled = true;
    }

    if (e.target.closest('.delete-btn')) {
      workoutEl.remove();
      const index = this.#workouts.findIndex(w => w.id === workout.id);

      this.#workouts.splice(index, 1);
      this._setLocalStorage();
      // this._getLocalStorage();
      if (this.#workouts.length === 0) {
        filters.classList.add('hidden');
      }

      const marker = this.#workoutMarkers.get(workout.id);
      if (marker) this.#map.removeLayer(marker);
      this.#workoutMarkers.delete(workout.id);

      return;
    }

    this.#map.setView(workout.coords, this.#mapZoomLevel, {
      animate: true,
      pan: {
        duration: 1,
      },
    });

    workout.click();
  }

  _setLocalStorage() {
    localStorage.setItem('workouts', JSON.stringify(this.#workouts));
  }

  _getLocalStorage() {
    const data = JSON.parse(localStorage.getItem('workouts'));

    if (!data) return;

    const newData = data.map(workout => {
      if (workout.type === 'running') {
        let newRunning = new Running(
          workout.coords,
          workout.distance,
          workout.duration,
          workout.cadence,
        );

        newRunning.id = workout.id;
        newRunning.date = new Date(workout.date);

        return newRunning;
      }

      if (workout.type === 'cycling') {
        let newRunning = new Cycling(
          workout.coords,
          workout.distance,
          workout.duration,
          workout.elevationGain,
        );

        newRunning.id = workout.id;
        newRunning.date = new Date(workout.date);

        return newRunning;
      }
    });

    this.#workouts = newData;
    this.#workouts.forEach(workout => {
      this._renderWorkout(workout);
    });
  }

  reset() {
    localStorage.removeItem('workouts');
    location.reload();
  }

  _filterBtnEvent(e) {
    if (e.target.closest('.delete-fn')) {
      this.reset();
    }
  }
}

const app = new App();
