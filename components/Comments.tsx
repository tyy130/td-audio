import React, { useEffect, useState } from 'react';

export default function Comments() {
  const [comment, setComment] = useState('');
  const [list, setList] = useState<Array<{id:number,comment:string,created_at:number}>>([]);
  const [loading, setLoading] = useState(false);

  const fetchComments = async () => {
    try {
      const res = await fetch('/comments');
      if (res.ok) setList(await res.json());
    } catch (e) { console.warn(e); }
  };

  useEffect(() => { fetchComments(); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/comments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ comment }) });
      if (res.ok) {
        setComment('');
        await fetchComments();
      } else {
        const j = await res.json().catch(() => ({}));
        alert(j.message || 'Failed');
      }
    } finally { setLoading(false); }
  };

  return (
    <div className="comments">
      <h3>Comments (test DB)</h3>
      <form onSubmit={submit}>
        <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Write a comment" />
        <button type="submit" disabled={loading}>Submit</button>
      </form>
      <ul>
        {list.map((c) => (
          <li key={c.id}><small>{new Date(c.created_at).toLocaleString()}</small> — {c.comment}</li>
        ))}
      </ul>
    </div>
  );
}
