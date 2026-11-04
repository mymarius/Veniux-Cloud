import React from 'react';

// Shows the profile photo when one is set, otherwise the name's initials.
export default function UserAvatar({ src, name = '', letters = 2, className = '' }) {
  const initials = (name || 'VN').trim().slice(0, letters).toLocaleUpperCase('tr');
  return src
    ? <img src={src} alt="" className={`object-cover ${className}`} />
    : <span className={className} aria-hidden="true">{initials}</span>;
}
