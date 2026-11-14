import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react';
import axios from 'axios';
import DoctorVitals from './DoctorVitals';

jest.mock('axios');

describe('DoctorVitals patient-profile autofill', () => {
  const apiBaseUrl = 'http://api.test';
  const patientId = 'patient-1';
  let savedProfile;

  beforeEach(() => {
    localStorage.setItem('token', 'test-token');
    savedProfile = { uhid: '1001', bloodGroup: '', pastMedicalHistory: '', medicalAllergy: '' };
    axios.get.mockReset();
    axios.post.mockReset();
    axios.get.mockImplementation((url) => {
      if (url === `${apiBaseUrl}/api/users/patient-clinical-profile/${patientId}`) {
        return Promise.resolve({ data: { ...savedProfile } });
      }
      if (url.startsWith(`${apiBaseUrl}/api/vitals/`)) {
        return Promise.reject({ response: { status: 404 } });
      }
      return Promise.reject(new Error(`Unexpected GET ${url}`));
    });
    axios.post.mockImplementation((url, formData) => {
      if (url !== `${apiBaseUrl}/api/vitals/save`) {
        return Promise.reject(new Error(`Unexpected POST ${url}`));
      }
      savedProfile = {
        ...savedProfile,
        bloodGroup: formData.get('bloodGroup'),
        pastMedicalHistory: formData.get('pastMedicalHistory'),
        medicalAllergy: formData.get('medicalAllergy'),
      };
      return Promise.resolve({ data: { success: true, vital: { _id: 'vital-1' } } });
    });
  });

  test('saves profile details on one appointment and autofills them on the next for the same patient', async () => {
    const { container, getByText, rerender } = render(
      <DoctorVitals appointmentId="appointment-1" patientId={patientId} apiBaseUrl={apiBaseUrl} />
    );

    fireEvent.change(container.querySelector('[name="bloodGroup"]'), { target: { value: 'O+' } });
    fireEvent.change(container.querySelector('[name="pastMedicalHistory"]'), { target: { value: 'Asthma' } });
    fireEvent.change(container.querySelector('[name="medicalAllergy"]'), { target: { value: 'Penicillin' } });
    fireEvent.click(getByText('Save Case Sheet'));

    await waitFor(() => expect(axios.post).toHaveBeenCalledTimes(1));
    expect(axios.post.mock.calls[0][1].get('patientId')).toBe(patientId);

    rerender(
      <DoctorVitals appointmentId="appointment-2" patientId={patientId} apiBaseUrl={apiBaseUrl} />
    );

    await waitFor(() => {
      expect(container.querySelector('[name="bloodGroup"]').value).toBe('O+');
      expect(container.querySelector('[name="pastMedicalHistory"]').value).toBe('Asthma');
      expect(container.querySelector('[name="medicalAllergy"]').value).toBe('Penicillin');
    });

    const profileRequests = axios.get.mock.calls
      .map(([url]) => url)
      .filter((url) => url.includes('/patient-clinical-profile/'));
    expect(profileRequests).toEqual([
      `${apiBaseUrl}/api/users/patient-clinical-profile/${patientId}`,
      `${apiBaseUrl}/api/users/patient-clinical-profile/${patientId}`,
    ]);
  });
});
