import { useEffect, useState } from 'react';
import '../../styles/doctor/trial.css';
import axios from 'axios';
function FileRow({ file }) {
  const [checkedItems, setCheckedItems] = useState({});

  const toggleCheckbox = (idx) => {
    setCheckedItems((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  };

  return (
    <td>
      <div style={{ maxHeight: '80px', overflowY: 'auto' }}>
        {Array.isArray(file.medicationList)
          ? file.medicationList.map((med, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={!!checkedItems[idx]}
                  onChange={() => toggleCheckbox(idx)}
                  style={{ marginRight: '8px' }}
                />
                <span style={{ textDecoration: checkedItems[idx] ? 'line-through' : 'none' }}>
                  {med}
                </span>
              </div>
            ))
          : ''}
      </div>
    </td>
  );
}

function Trial() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [editMode, setEditMode] = useState(false);
  const [editedFiles, setEditedFiles] = useState([]); // editable version of files

  useEffect(() => {
  axios
    .get('http://localhost:5000/api/trialread/files')
    .then((res) => {
      setFiles(res.data);
      setLoading(false);
    })
    .catch((err) => {
      setError(err.message);
      setLoading(false);
    });
}, []);

  useEffect(() => {
    if (!loading && !error) {
      setEditedFiles(JSON.parse(JSON.stringify(files))); // deep copy
    }
  }, [files]);

  const [transposed, setTransposed] = useState(false);

  const renderOriginalTable = () => (
    <table border="1" cellPadding="8" style={{ margin: 'auto', minWidth: 400 }}>
      <thead>
        <tr>
          <th>Name</th>
          <th>Sex</th>
          <th>Age</th>
          <th>Date and Time of Visit</th>
          <th>Phone number</th>
          <th>E-mail ID</th>
          <th>Walk In</th>
          <th>Medication Prescribed</th>
          <th>Year</th>
          <th>Dept.</th>
          <th>Place of Origin</th>
          <th>Mode of Referral</th>
          <th>Refer to</th>
          <th>Notes</th>
        </tr>
      </thead>
      <tbody>
        {files.map((file) => (
          <tr key={file._id}>
            <td>{file.name}</td>
            <td>{file.sex}</td>
            <td>{file.age}</td>
            <td>
              <div style={{ maxHeight: '80px', overflowY: 'auto' }}>
                {Array.isArray(file.dateAndTimeOfVisit)
                  ? file.dateAndTimeOfVisit.map((dt, idx) => (
                      <div key={idx}>{new Date(dt).toLocaleString()}</div>
                    ))
                  : ''}
              </div>
            </td>
            <td>{file.phoneNumber}</td>
            <td>{file.emailId}</td>
            <td>{file.walkIn ? 'Yes' : 'No'}</td>     
            <FileRow file={file} />
            <td>{file.year}</td>
            <td>{file.department}</td>
            <td>{file.placeOfOrigin}</td>
            <td>{file.modeOfReferral}</td>
            <td>{file.referTo}</td>
            <td><div style={{ maxHeight: '80px', overflowY: 'auto' }}>{file.notes}</div></td>       
          </tr>
        ))}
      </tbody>
    </table>
  );

  const headings = [
  { label: 'Name', key: 'name' },
  { label: 'Sex', key: 'sex' },
  { label: 'Age', key: 'age' },
  { label: 'Date and Time of Visit', key: 'dateAndTimeOfVisit' },
  { label: 'Phone number', key: 'phoneNumber' },
  { label: 'E-mail ID', key: 'emailId' },
  { label: 'Walk In', key: 'walkIn' },
  { label: 'Medication Prescribed', key: 'medicationList' },
  { label: 'Year', key: 'year' },
  { label: 'Dept.', key: 'department' },
  { label: 'Place of Origin', key: 'placeOfOrigin' },
  { label: 'Mode of Referral', key: 'modeOfReferral' },
  { label: 'Refer to', key: 'referTo' },
  { label: 'Notes', key: 'notes' },
];

  const handleSave = async () => {
    try {
      for (const file of editedFiles) {
        const res = await axios.put(`http://localhost:5000/api/trialread/files/${file._id}`, file);
        if (res.status !== 200) throw new Error(`Failed to update file with ID ${file._id}`);
      }
      alert('Files updated successfully!');
      setEditMode(false);
    } catch (err) {
      alert('Error while saving: ' + (err.response?.data?.error || err.message));
    }
  };

  const renderTransposedTable = () => (
    <table border="1" cellPadding="8" style={{ margin: 'auto', minWidth: 400 }}>
      <tbody>
        {headings.map(({ label, key }) => (
          <tr key={key}>
            <th>{label}</th>
            {files.map((file, colIdx) => (
              <td key={colIdx}>
                {editMode ? (
                  <input
                    style={{ width: '100%' }}
                    value={editedFiles[colIdx]?.[key] ?? ''}
                    onChange={e => {
                      const newFiles = [...editedFiles];
                      newFiles[colIdx][key] = e.target.value;
                      setEditedFiles(newFiles);
                    }}
                  />
                ) : (
                key === 'walkIn'
                  ? file[key] ? 'Yes' : 'No'
                    : key === 'dateAndTimeOfVisit' && Array.isArray(file[key])
                    ? file[key].map((dt, idx) => (
                        <div key={idx}>{new Date(dt).toLocaleString()}</div>
                      ))
                    : key === 'medicationList' && Array.isArray(file[key])
                    ? <FileRow file={file} />
                    : key === 'notes'
                    ? <div style={{ maxHeight: '50px', overflowY: 'auto' }}>{file[key]}</div>
                    : file[key] || ''
                )}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <div className="App">
      <h1>IITDH Doctor App</h1>
      <script async src="https://cse.google.com/cse.js?cx=945783e8706374877">
      </script>
      <div class="gcse-search"></div>
      {loading && <p>Loading...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {!loading && !error && (
          <div style={{ textAlign: 'center' }}>
            <button onClick={() => setTransposed(prev => !prev)} style={{ margin: '20px' }}>
              {transposed ? 'Show Horizontal View' : 'Show Vertical (Transposed) View'}
            </button>
            {transposed ? renderTransposedTable() : renderOriginalTable()}
            {!editMode ? (
              <button onClick={() => setEditMode(true)}>Edit</button>
            ) : (
              <button onClick={handleSave}>Save</button>
            )}
          </div>
      )}
    </div>
  );
}

export default Trial;
